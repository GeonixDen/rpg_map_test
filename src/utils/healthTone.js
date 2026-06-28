export function getHealthRatio(entity) {
  const health = Number(entity?.health);
  const maxHealth = Number(entity?.maxHealth);

  if (!Number.isFinite(health) || !Number.isFinite(maxHealth) || maxHealth <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, health / maxHealth));
}

export function getHealthPercent(entity) {
  return getHealthRatio(entity) * 100;
}

export function getHealthTone(entity) {
  const ratio = getHealthRatio(entity);

  if (ratio <= 0.33) return 'danger';
  if (ratio <= 0.66) return 'warning';
  return 'healthy';
}
