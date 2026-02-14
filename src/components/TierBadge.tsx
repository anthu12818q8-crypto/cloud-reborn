interface TierBadgeProps {
  tierKey: string;
  displayName: string;
  icon: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TierBadge({ tierKey, displayName, icon, size = 'sm', className = '' }: TierBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2.5 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };

  return (
    <span className={`tier-badge tier-${tierKey} ${sizeClasses[size]} ${className}`}>
      <span>{icon}</span>
      <span>{displayName}</span>
    </span>
  );
}
