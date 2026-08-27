interface Request {
  json<T = any>(): Promise<T>;
}

interface Response {
  json<T = any>(): Promise<T>;
}
