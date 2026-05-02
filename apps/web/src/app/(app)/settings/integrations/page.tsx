'use client';

import { Github, Mail, MessageSquare, Slack } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@/components/ui';

const INTEGRATIONS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, status: 'connected', description: 'Send & receive WhatsApp commands and notifications.' },
  { id: 'github', name: 'GitHub', icon: Github, status: 'available', description: 'Link commits and pull requests to tasks.' },
  { id: 'slack', name: 'Slack', icon: Slack, status: 'available', description: 'Send notifications to Slack channels.' },
  { id: 'email', name: 'Email', icon: Mail, status: 'connected', description: 'Configure SMTP for outgoing emails.' },
];

export default function IntegrationsSettingsPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {INTEGRATIONS.map((it) => (
        <Card key={it.id}>
          <CardBody>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[color:var(--color-surface-2)] flex items-center justify-center">
                  <it.icon className="h-5 w-5 text-[color:var(--color-fg-muted)]" />
                </div>
                <div>
                  <p className="font-semibold">{it.name}</p>
                  <Badge tone={it.status === 'connected' ? 'success' : 'neutral'} size="sm" className="mt-0.5">
                    {it.status === 'connected' ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-[color:var(--color-fg-muted)] mb-4">{it.description}</p>
            <Button variant={it.status === 'connected' ? 'secondary' : 'primary'} size="sm" className="w-full">
              {it.status === 'connected' ? 'Configure' : 'Connect'}
            </Button>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
