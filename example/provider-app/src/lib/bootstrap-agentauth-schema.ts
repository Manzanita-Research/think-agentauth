export async function bootstrapAgentAuthSchema(database: D1Database) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS agentHost (
      id TEXT PRIMARY KEY,
      name TEXT,
      userId TEXT,
      defaultCapabilities TEXT,
      publicKey TEXT,
      kid TEXT,
      jwksUrl TEXT,
      enrollmentTokenHash TEXT,
      enrollmentTokenExpiresAt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      activatedAt TEXT,
      expiresAt TEXT,
      lastUsedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,

    "CREATE INDEX IF NOT EXISTS idx_agentHost_userId ON agentHost(userId)",
    "CREATE INDEX IF NOT EXISTS idx_agentHost_kid ON agentHost(kid)",
    "CREATE INDEX IF NOT EXISTS idx_agentHost_enrollmentTokenHash ON agentHost(enrollmentTokenHash)",
    "CREATE INDEX IF NOT EXISTS idx_agentHost_status ON agentHost(status)",

    `CREATE TABLE IF NOT EXISTS agent (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      userId TEXT,
      hostId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      mode TEXT NOT NULL DEFAULT 'delegated',
      publicKey TEXT NOT NULL,
      kid TEXT,
      jwksUrl TEXT,
      lastUsedAt TEXT,
      activatedAt TEXT,
      expiresAt TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,

    "CREATE INDEX IF NOT EXISTS idx_agent_userId ON agent(userId)",
    "CREATE INDEX IF NOT EXISTS idx_agent_hostId ON agent(hostId)",
    "CREATE INDEX IF NOT EXISTS idx_agent_status ON agent(status)",
    "CREATE INDEX IF NOT EXISTS idx_agent_kid ON agent(kid)",

    `CREATE TABLE IF NOT EXISTS agentCapabilityGrant (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      capability TEXT NOT NULL,
      deniedBy TEXT,
      grantedBy TEXT,
      expiresAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reason TEXT,
      constraints TEXT
    )`,

    "CREATE INDEX IF NOT EXISTS idx_agentCapabilityGrant_agentId ON agentCapabilityGrant(agentId)",
    "CREATE INDEX IF NOT EXISTS idx_agentCapabilityGrant_capability ON agentCapabilityGrant(capability)",
    "CREATE INDEX IF NOT EXISTS idx_agentCapabilityGrant_grantedBy ON agentCapabilityGrant(grantedBy)",
    "CREATE INDEX IF NOT EXISTS idx_agentCapabilityGrant_status ON agentCapabilityGrant(status)",

    `CREATE TABLE IF NOT EXISTS approvalRequest (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      agentId TEXT,
      hostId TEXT,
      userId TEXT,
      capabilities TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      userCodeHash TEXT,
      loginHint TEXT,
      bindingMessage TEXT,
      clientNotificationToken TEXT,
      clientNotificationEndpoint TEXT,
      deliveryMode TEXT,
      interval INTEGER NOT NULL,
      lastPolledAt TEXT,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,

    "CREATE INDEX IF NOT EXISTS idx_approvalRequest_agentId ON approvalRequest(agentId)",
    "CREATE INDEX IF NOT EXISTS idx_approvalRequest_hostId ON approvalRequest(hostId)",
    "CREATE INDEX IF NOT EXISTS idx_approvalRequest_userId ON approvalRequest(userId)",
    "CREATE INDEX IF NOT EXISTS idx_approvalRequest_status ON approvalRequest(status)",
  ];

  for (const statement of statements) {
    await database.prepare(statement).run();
  }
}
