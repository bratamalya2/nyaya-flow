import neo4j, { type Driver, type Session } from "neo4j-driver";

export type Neo4jMode = "READ" | "WRITE";

export class Neo4jUnavailableError extends Error {
  constructor() {
    super("The citation graph is not configured.");
    this.name = "Neo4jUnavailableError";
  }
}

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
}

declare global {
  var nyayaFlowNeo4jDriver: Driver | undefined;
}

export function neo4jConfig(): Neo4jConfig | null {
  const uri = process.env.NEO4J_URI?.trim();
  const username = process.env.NEO4J_USERNAME?.trim();
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !username || !password) return null;
  return { uri, username, password, database: process.env.NEO4J_DATABASE?.trim() || "neo4j" };
}

/** The graph is optional: PostgreSQL remains the canonical source of authority records. */
export function isNeo4jConfigured() {
  return neo4jConfig() !== null;
}

function graphDriver() {
  const config = neo4jConfig();
  if (!config) throw new Neo4jUnavailableError();
  if (!global.nyayaFlowNeo4jDriver) {
    global.nyayaFlowNeo4jDriver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
      maxConnectionPoolSize: 16,
      connectionAcquisitionTimeout: 8_000,
    });
  }
  return { driver: global.nyayaFlowNeo4jDriver, database: config.database };
}

/**
 * Only public, rights-approved authority identifiers and citation metadata may cross this
 * boundary. Callers must never project organization, matter, document, note, or query data.
 */
export async function withNeo4jSession<T>(mode: Neo4jMode, operation: (session: Session) => Promise<T>) {
  const { driver, database } = graphDriver();
  const session = driver.session({ database, defaultAccessMode: mode });
  try {
    return await operation(session);
  } finally {
    await session.close();
  }
}

export async function closeNeo4jDriver() {
  if (global.nyayaFlowNeo4jDriver) {
    await global.nyayaFlowNeo4jDriver.close();
    global.nyayaFlowNeo4jDriver = undefined;
  }
}
