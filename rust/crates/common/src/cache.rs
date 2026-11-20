use std::{hash::Hash, sync::Arc, time::Duration};

use moka::future::Cache;

use crate::error::{Error, SharedError};

pub fn ttl_cache<K, V>(ttl: Duration, capacity: u64) -> Cache<K, V>
where
    K: Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    Cache::builder()
        .max_capacity(capacity)
        .time_to_live(ttl)
        .build()
}

/// moka's `try_get_with` deduplicates concurrent misses for the same key and
/// does not cache `Err` results. Errors are wrapped in `Arc` so every waiter
/// receives the same failure without requiring `Clone` on the underlying type.
pub async fn single_flight<K, V, F, Fut>(
    cache: &Cache<K, V>,
    key: K,
    init: F,
) -> std::result::Result<V, SharedError>
where
    K: Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = std::result::Result<V, Error>>,
{
    cache.try_get_with(key, async move { init().await }).await
}

pub fn shared(err: Error) -> SharedError {
    Arc::new(err)
}
