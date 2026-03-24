'use client';

import { type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', gap: 2,
        background: 'var(--bg-secondary)',
        padding: 4, borderRadius: 'var(--radius-md)',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
            color: activeTab === tab.id ? 'var(--accent-teal, var(--accent-blue))' : 'var(--text-muted)',
            boxShadow: activeTab === tab.id ? 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.1))' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
