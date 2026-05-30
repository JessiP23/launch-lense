-- Seed Signal Fabric with realistic benchmark data
-- This migration populates signal_benchmarks with realistic CTR, CPC, CVR, and CPA data
-- based on industry standards and channel performance characteristics

-- Clear existing data (optional - comment out if you want to preserve existing data)
-- TRUNCATE TABLE signal_benchmarks CASCADE;

-- SaaS Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('saas', 'meta', 0.0142, 85.50, 0.0450, 1900.00, 12, NOW()),
('saas', 'google', 0.0115, 92.30, 0.0420, 2198.00, 15, NOW()),
('saas', 'linkedin', 0.0098, 145.00, 0.0580, 2500.00, 8, NOW()),
('saas', 'tiktok', 0.0185, 65.00, 0.0380, 1710.00, 6, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- Fintech Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('fintech', 'meta', 0.0118, 95.00, 0.0380, 2500.00, 9, NOW()),
('fintech', 'google', 0.0095, 102.50, 0.0350, 2929.00, 11, NOW()),
('fintech', 'linkedin', 0.0082, 155.00, 0.0480, 3229.00, 7, NOW()),
('fintech', 'tiktok', 0.0150, 72.00, 0.0320, 2250.00, 4, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- Health Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('health', 'meta', 0.0095, 88.00, 0.0420, 2095.00, 6, NOW()),
('health', 'google', 0.0078, 95.50, 0.0390, 2449.00, 8, NOW()),
('health', 'linkedin', 0.0065, 148.00, 0.0450, 3289.00, 5, NOW()),
('health', 'tiktok', 0.0120, 68.00, 0.0350, 1943.00, 3, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- E-commerce Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('ecommerce', 'meta', 0.0185, 72.00, 0.0550, 1309.00, 18, NOW()),
('ecommerce', 'google', 0.0150, 78.50, 0.0520, 1510.00, 22, NOW()),
('ecommerce', 'linkedin', 0.0120, 125.00, 0.0650, 1923.00, 9, NOW()),
('ecommerce', 'tiktok', 0.0240, 55.00, 0.0480, 1146.00, 11, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- Consumer Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('consumer', 'meta', 0.0155, 68.00, 0.0480, 1417.00, 14, NOW()),
('consumer', 'google', 0.0128, 74.50, 0.0450, 1656.00, 16, NOW()),
('consumer', 'linkedin', 0.0105, 122.00, 0.0550, 2218.00, 7, NOW()),
('consumer', 'tiktok', 0.0200, 52.00, 0.0420, 1238.00, 9, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- B2B Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('b2b', 'meta', 0.0130, 92.00, 0.0430, 2139.00, 10, NOW()),
('b2b', 'google', 0.0105, 98.50, 0.0400, 2462.00, 13, NOW()),
('b2b', 'linkedin', 0.0090, 150.00, 0.0520, 2885.00, 11, NOW()),
('b2b', 'tiktok', 0.0165, 70.00, 0.0360, 1944.00, 5, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;

-- Other Benchmarks
INSERT INTO signal_benchmarks (vertical, channel, avg_ctr, avg_cpc, avg_cvr, avg_cpa, sample_size, last_updated) VALUES
('other', 'meta', 0.0120, 80.00, 0.0450, 1778.00, 7, NOW()),
('other', 'google', 0.0098, 87.50, 0.0420, 2083.00, 9, NOW()),
('other', 'linkedin', 0.0080, 140.00, 0.0500, 2800.00, 4, NOW()),
('other', 'tiktok', 0.0155, 62.00, 0.0380, 1632.00, 3, NOW())
ON CONFLICT (vertical, channel) DO UPDATE SET
  avg_ctr = EXCLUDED.avg_ctr,
  avg_cpc = EXCLUDED.avg_cpc,
  avg_cvr = EXCLUDED.avg_cvr,
  avg_cpa = EXCLUDED.avg_cpa,
  sample_size = EXCLUDED.sample_size,
  last_updated = EXCLUDED.last_updated;
