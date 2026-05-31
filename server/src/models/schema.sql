CREATE DATABASE IF NOT EXISTS huaxi DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE huaxi;

CREATE TABLE IF NOT EXISTS themes (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  season VARCHAR(20),
  query_keywords JSON,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destinations (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  lat DECIMAL(10, 6) NOT NULL,
  lng DECIMAL(10, 6) NOT NULL,
  address VARCHAR(255),
  rating DECIMAL(2, 1) DEFAULT 0,
  best_season VARCHAR(50),
  description TEXT,
  highlights JSON,
  tags JSON,
  image_url VARCHAR(500),
  duration INT DEFAULT 3,
  transport_guide TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destination_themes (
  destination_id VARCHAR(36),
  theme_id VARCHAR(36),
  PRIMARY KEY (destination_id, theme_id),
  FOREIGN KEY (destination_id) REFERENCES destinations(id),
  FOREIGN KEY (theme_id) REFERENCES themes(id)
);

CREATE TABLE IF NOT EXISTS itineraries (
  id VARCHAR(36) PRIMARY KEY,
  destination_id VARCHAR(36) NOT NULL,
  day_number INT NOT NULL,
  title VARCHAR(100),
  morning TEXT,
  afternoon TEXT,
  evening TEXT,
  meals JSON,
  FOREIGN KEY (destination_id) REFERENCES destinations(id)
);

CREATE TABLE IF NOT EXISTS tips (
  id VARCHAR(36) PRIMARY KEY,
  destination_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (destination_id) REFERENCES destinations(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id VARCHAR(36) PRIMARY KEY,
  destination_id VARCHAR(36) NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount INT DEFAULT 0,
  FOREIGN KEY (destination_id) REFERENCES destinations(id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id VARCHAR(36) PRIMARY KEY,
  openid VARCHAR(100) NOT NULL,
  destination_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (openid, destination_id)
);

CREATE TABLE IF NOT EXISTS user_history (
  id VARCHAR(36) PRIMARY KEY,
  openid VARCHAR(100) NOT NULL,
  destination_id VARCHAR(36) NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (openid, viewed_at)
);
