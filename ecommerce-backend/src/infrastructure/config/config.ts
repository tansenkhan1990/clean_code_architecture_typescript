import {
  loadEnvironment,
  parseEnvironment,
  type Config,
  type ConfigError,
} from "./environment.js";
import type { Result } from "../../domain/shared/result.js";

export type { Config, ConfigError };

/** Reads the process environment exactly once, for the composition root. */
export function loadConfig(): Result<Config, ConfigError> {
  return parseEnvironment(loadEnvironment());
}
