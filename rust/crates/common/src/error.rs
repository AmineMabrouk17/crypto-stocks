use std::sync::Arc;

#[derive(Debug, Clone, thiserror::Error, PartialEq, Eq)]
pub enum Error {
    #[error("{0}")]
    Upstream(String),
    #[error("{0}")]
    Parse(String),
    #[error("{0}")]
    Config(String),
    #[error("Upstream request timed out")]
    Timeout,
    #[error("Upstream transport error: {0}")]
    Transport(String),
}

impl Error {
    pub fn upstream(prefix: &str, status: u16) -> Self {
        Self::Upstream(format!("{prefix} request failed: {status}"))
    }

    pub fn parse(message: impl Into<String>) -> Self {
        Self::Parse(message.into())
    }
}

pub type SharedError = Arc<Error>;
pub type Result<T> = std::result::Result<T, Error>;
