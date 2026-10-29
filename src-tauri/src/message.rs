//! Text for the UI is never written here: the backend sends `{ code, params }` and the UI translates it.
use serde_json::{Map, Value};

pub(crate) type Message = Value;

pub(crate) fn message(code: &str, params: Map<String, Value>) -> Message {
    let mut message = Map::new();
    message.insert("code".into(), code.into());
    if !params.is_empty() {
        message.insert("params".into(), params.into());
    }
    message.into()
}

/// `msg!("log.network.server", banner = text)`: a code and its named parameters.
macro_rules! msg {
    ($code:expr $(, $key:ident = $value:expr)* $(,)?) => {{
        #[allow(unused_mut)]
        let mut params = serde_json::Map::new();
        $(params.insert(stringify!($key).into(), serde_json::Value::from($value));)*
        $crate::message::message($code, params)
    }};
}
pub(crate) use msg;
