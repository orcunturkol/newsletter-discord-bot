-- Create tables for the Discord bot
CREATE TABLE IF NOT EXISTS newsletters (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    sender_email VARCHAR(255) NOT NULL UNIQUE,
    extraction_pattern TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(36) PRIMARY KEY,
    newsletter_id VARCHAR(36) NOT NULL REFERENCES newsletters(id),
    title VARCHAR(512) NOT NULL,
    web_url VARCHAR(1024) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT,
    message_id VARCHAR(255),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guild_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    guild_id VARCHAR(36) NOT NULL,
    channel_id VARCHAR(36) NOT NULL,
    newsletter_id VARCHAR(36) NOT NULL REFERENCES newsletters(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, newsletter_id)
);

CREATE TABLE IF NOT EXISTS tracked_links (
    id VARCHAR(36) PRIMARY KEY,
    original_url VARCHAR(1024) NOT NULL,
    tracking_id VARCHAR(36) NOT NULL UNIQUE,
    issue_id VARCHAR(36) NOT NULL REFERENCES issues(id),
    newsletter_id VARCHAR(36) NOT NULL REFERENCES newsletters(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_clicks (
    id VARCHAR(36) PRIMARY KEY,
    tracked_link_id VARCHAR(36) NOT NULL REFERENCES tracked_links(id),
    clicked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_hash VARCHAR(64),
    guild_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_issues_newsletter_id ON issues(newsletter_id);
CREATE INDEX idx_issues_processed ON issues(processed);
CREATE INDEX idx_guild_subscriptions_guild_id ON guild_subscriptions(guild_id);
CREATE INDEX idx_guild_subscriptions_newsletter_id ON guild_subscriptions(newsletter_id);
CREATE INDEX idx_guild_subscriptions_active ON guild_subscriptions(active);
CREATE INDEX idx_tracked_links_issue_id ON tracked_links(issue_id);
CREATE INDEX idx_link_clicks_tracked_link_id ON link_clicks(tracked_link_id);