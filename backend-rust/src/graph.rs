use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap, HashSet};

#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum Kind {
    Input,
    Linear,
    Relu,
    Sigmoid,
    Tanh,
    Flatten,
    Dropout,
    Output,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Self::Input => "input",
            Self::Linear => "linear",
            Self::Relu => "relu",
            Self::Sigmoid => "sigmoid",
            Self::Tanh => "tanh",
            Self::Flatten => "flatten",
            Self::Dropout => "dropout",
            Self::Output => "output",
        }
    }

    fn keys(self) -> &'static [&'static str] {
        match self {
            Self::Input => &["features"],
            Self::Linear => &["out_features", "bias"],
            Self::Dropout => &["p"],
            Self::Output => &["classes"],
            _ => &[],
        }
    }
}

#[derive(Deserialize)]
struct Position {
    #[serde(rename = "x")]
    _x: f64,
    #[serde(rename = "y")]
    _y: f64,
}

#[derive(Deserialize)]
struct Node {
    id: String,
    #[serde(rename = "type")]
    kind: Kind,
    #[serde(rename = "position")]
    _position: Position,
    #[serde(default)]
    params: Map<String, Value>,
}

#[derive(Deserialize)]
struct Edge {
    id: String,
    source: String,
    target: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Graph {
    schema_version: i64,
    #[serde(default = "default_name")]
    pub name: String,
    #[serde(default)]
    nodes: Vec<Node>,
    #[serde(default)]
    edges: Vec<Edge>,
}

fn default_name() -> String {
    "Untitled network".into()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    code: &'static str,
    message: String,
    node_id: Option<String>,
    edge_id: Option<String>,
}

impl Issue {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            node_id: None,
            edge_id: None,
        }
    }

    fn node(mut self, id: &str) -> Self {
        self.node_id = Some(id.to_owned());
        self
    }

    fn edge(mut self, id: &str) -> Self {
        self.edge_id = Some(id.to_owned());
        self
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Validation {
    pub valid: bool,
    pub errors: Vec<Issue>,
    shapes: BTreeMap<String, [i64; 1]>,
    node_errors: BTreeMap<String, String>,
}

pub struct Analysis {
    pub validation: Validation,
    pub layers: Vec<Layer>,
}

#[derive(Clone, Copy)]
pub enum Layer {
    Linear { input: i64, output: i64, bias: bool },
    Relu,
    Sigmoid,
    Tanh,
    Flatten,
    Dropout(f64),
}

#[derive(Clone, Copy)]
enum Operation {
    Input(i64),
    Output(i64),
    Linear(i64, bool),
    Pass(Layer),
}

fn value_kind(value: &Value) -> &'static str {
    match value {
        Value::Null => "NoneType",
        Value::Bool(_) => "bool",
        Value::String(_) => "str",
        Value::Array(_) => "list",
        Value::Object(_) => "dict",
        Value::Number(n) if n.is_f64() => "float",
        Value::Number(_) => "int",
    }
}

impl Node {
    fn param_error(&self, key: &str, detail: impl std::fmt::Display) -> Issue {
        Issue::new(
            "invalid_param",
            format!(
                "Node {:?} ({}): parameter {key:?} {detail}.",
                self.id,
                self.kind.name(),
            ),
        )
        .node(&self.id)
    }

    fn operation(&self, issues: &mut Vec<Issue>) -> Operation {
        for key in self
            .params
            .keys()
            .filter(|key| !self.kind.keys().contains(&key.as_str()))
        {
            issues.push(
                Issue::new(
                    "unknown_param",
                    format!(
                        "Node {:?} ({}): unknown parameter {key:?}.",
                        self.id,
                        self.kind.name(),
                    ),
                )
                .node(&self.id),
            );
        }
        let mut dimension = |key: &str, default: i64| {
            if let Some(value) = self.params.get(key) {
                match value.as_i64() {
                    Some(n) if n >= 1 => return n,
                    Some(_) => issues.push(self.param_error(key, "must be >= 1")),
                    None if value.is_u64() => {
                        issues.push(self.param_error(key, format!("must be <= {}", i64::MAX)))
                    }
                    None => issues.push(self.param_error(
                        key,
                        format!("must be an integer, got {}", value_kind(value)),
                    )),
                }
            }
            default
        };
        match self.kind {
            Kind::Input => Operation::Input(dimension("features", 784)),
            Kind::Output => Operation::Output(dimension("classes", 10)),
            Kind::Linear => {
                let width = dimension("out_features", 128);
                let bias = self.params.get("bias").is_none_or(|value| {
                    value.as_bool().unwrap_or_else(|| {
                        issues.push(self.param_error(
                            "bias",
                            format!("must be a boolean, got {}", value_kind(value)),
                        ));
                        true
                    })
                });
                Operation::Linear(width, bias)
            }
            Kind::Dropout => {
                let p = self.params.get("p").map_or(0.5, |value| {
                    match value.as_f64() {
                        Some(p) if (0.0..=0.99).contains(&p) => return p,
                        Some(p) if p < 0.0 => issues.push(self.param_error("p", "must be >= 0.0")),
                        Some(_) => issues.push(self.param_error("p", "must be <= 0.99")),
                        None => issues.push(self.param_error(
                            "p",
                            format!("must be a number, got {}", value_kind(value)),
                        )),
                    }
                    0.5
                });
                Operation::Pass(Layer::Dropout(p))
            }
            Kind::Relu => Operation::Pass(Layer::Relu),
            Kind::Sigmoid => Operation::Pass(Layer::Sigmoid),
            Kind::Tanh => Operation::Pass(Layer::Tanh),
            Kind::Flatten => Operation::Pass(Layer::Flatten),
        }
    }
}

impl Graph {
    pub fn check_schema(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err(format!(
                "Unsupported schemaVersion {}. This backend supports schemaVersion 1.",
                self.schema_version
            ));
        }
        if self.nodes.iter().any(|node| node.id.is_empty()) {
            return Err("Node id must not be empty.".into());
        }
        if self
            .edges
            .iter()
            .any(|edge| edge.id.is_empty() || edge.source.is_empty() || edge.target.is_empty())
        {
            return Err("Edge id, source, and target must not be empty.".into());
        }
        Ok(())
    }

    pub fn analyze(&self) -> Analysis {
        let mut errors = vec![];
        let operations: Vec<_> = self
            .nodes
            .iter()
            .map(|node| node.operation(&mut errors))
            .collect();
        let mut shapes = BTreeMap::new();
        let mut layers = vec![];
        if errors.is_empty() {
            match self.chain() {
                Ok(chain) => {
                    // Schema v1 has exactly one feature dimension (excluding batch).
                    let mut width = 0;
                    for index in chain {
                        let node = &self.nodes[index];
                        match operations[index] {
                            Operation::Input(features) => width = features,
                            Operation::Linear(output, bias) => {
                                layers.push(Layer::Linear {
                                    input: width,
                                    output,
                                    bias,
                                });
                                width = output;
                            }
                            Operation::Pass(layer) => layers.push(layer),
                            Operation::Output(classes) if classes != width => {
                                errors.push(Issue::new("shape_error", format!(
                                    "Node {:?} (output): Output declares {classes} classes but the incoming shape is [{width}]. Make the previous Linear layer's out_features equal to {classes}, or change this Output node's classes to {width}.", node.id,
                                )).node(&node.id));
                                break;
                            }
                            Operation::Output(_) => {}
                        }
                        shapes.insert(node.id.clone(), [width]);
                    }
                }
                Err(issues) => errors = issues,
            }
        }
        let mut node_errors = BTreeMap::new();
        for issue in &errors {
            if let Some(id) = &issue.node_id {
                node_errors
                    .entry(id.clone())
                    .or_insert_with(|| issue.message.clone());
            }
        }
        let valid = errors.is_empty();
        if !valid {
            layers.clear();
        }
        Analysis {
            validation: Validation {
                valid,
                errors,
                shapes,
                node_errors,
            },
            layers,
        }
    }

    fn chain(&self) -> Result<Vec<usize>, Vec<Issue>> {
        if self.nodes.is_empty() {
            return Err(vec![Issue::new("empty_graph", "Graph has no nodes.")]);
        }
        let mut issues = vec![];
        let mut by_id = HashMap::new();
        let mut unique = vec![];
        let mut skip_degrees = false;
        for (index, node) in self.nodes.iter().enumerate() {
            if let std::collections::hash_map::Entry::Vacant(entry) = by_id.entry(node.id.as_str())
            {
                entry.insert(index);
                unique.push(index);
            } else {
                issues.push(
                    Issue::new(
                        "duplicate_node_id",
                        format!("Duplicate node id {:?}.", node.id),
                    )
                    .node(&node.id),
                );
                skip_degrees = true;
            }
        }
        let mut incoming = vec![0; self.nodes.len()];
        let mut outgoing = vec![vec![]; self.nodes.len()];
        let mut seen_edges = HashSet::new();
        for edge in &self.edges {
            if !seen_edges.insert(edge.id.as_str()) {
                issues.push(
                    Issue::new(
                        "duplicate_edge_id",
                        format!("Duplicate edge id {:?}.", edge.id),
                    )
                    .edge(&edge.id),
                );
                continue;
            }
            match (
                by_id.get(edge.source.as_str()),
                by_id.get(edge.target.as_str()),
            ) {
                (None, _) => issues.push(
                    Issue::new(
                        "dangling_edge",
                        format!(
                            "Edge {:?} points from nonexistent node {:?}.",
                            edge.id, edge.source
                        ),
                    )
                    .edge(&edge.id),
                ),
                (_, None) => issues.push(
                    Issue::new(
                        "dangling_edge",
                        format!(
                            "Edge {:?} points to nonexistent node {:?}.",
                            edge.id, edge.target
                        ),
                    )
                    .edge(&edge.id),
                ),
                (Some(source), Some(target)) if source == target => issues.push(
                    Issue::new(
                        "self_loop",
                        format!(
                            "Edge {:?} connects node {:?} to itself.",
                            edge.id, edge.source
                        ),
                    )
                    .edge(&edge.id),
                ),
                (Some(&source), Some(&target)) => {
                    outgoing[source].push(target);
                    incoming[target] += 1;
                    continue;
                }
            }
            skip_degrees = true;
        }

        let inputs: Vec<_> = unique
            .iter()
            .copied()
            .filter(|&i| self.nodes[i].kind == Kind::Input)
            .collect();
        let outputs = unique
            .iter()
            .filter(|&&i| self.nodes[i].kind == Kind::Output)
            .count();
        for (count, label, missing, multiple) in [
            (inputs.len(), "Input", "missing_input", "multiple_inputs"),
            (outputs, "Output", "missing_output", "multiple_outputs"),
        ] {
            match count {
                0 => issues.push(Issue::new(
                    missing,
                    format!("Graph must contain exactly one {label} node."),
                )),
                1 => {}
                _ => issues.push(Issue::new(
                    multiple,
                    format!("Graph has {count} {label} nodes; exactly one is required."),
                )),
            }
        }
        if !skip_degrees {
            for index in unique {
                let node = &self.nodes[index];
                let in_count = incoming[index];
                let out_count = outgoing[index].len();
                for (disallowed, count, direction) in [
                    (node.kind == Kind::Input, in_count, "incoming"),
                    (node.kind == Kind::Output, out_count, "outgoing"),
                ] {
                    if disallowed && count > 0 {
                        issues.push(Issue::new("invalid_connection", format!(
                            "Node {:?} ({}) cannot have {direction} connections, but has {count}.", node.id, node.kind.name(),
                        )).node(&node.id));
                    }
                }
                for (count, direction) in [(in_count, "incoming"), (out_count, "outgoing")] {
                    if count > 1 {
                        issues.push(Issue::new("branching", format!(
                            "Node {:?} has {count} {direction} edges. Milestone 1/2 support sequential single-path graphs only.", node.id,
                        )).node(&node.id));
                    }
                }
            }
        }
        if !issues.is_empty() {
            return Err(issues);
        }

        let mut index = inputs[0];
        let mut visited = vec![false; self.nodes.len()];
        let mut chain = Vec::with_capacity(self.nodes.len());
        loop {
            let node = &self.nodes[index];
            if visited[index] {
                return Err(vec![Issue::new(
                    "cycle",
                    format!("Cycle detected involving node {:?}.", node.id),
                )
                .node(&node.id)]);
            }
            visited[index] = true;
            chain.push(index);
            if node.kind == Kind::Output {
                break;
            }
            let Some(&next) = outgoing[index].first() else {
                return Err(vec![Issue::new(
                    "broken_chain",
                    format!(
                        "Node {:?} ({}) has no outgoing edge but is not the Output node.",
                        node.id,
                        node.kind.name(),
                    ),
                )
                .node(&node.id)]);
            };
            index = next;
        }
        if chain.len() != self.nodes.len() {
            let mut missing: Vec<_> = self
                .nodes
                .iter()
                .zip(visited)
                .filter_map(|(node, seen)| (!seen).then_some(node.id.as_str()))
                .collect();
            missing.sort_unstable();
            return Err(vec![Issue::new(
                "disconnected_nodes",
                format!(
                    "These nodes are not reachable from the Input node: {}.",
                    missing.join(", "),
                ),
            )]);
        }
        Ok(chain)
    }
}
