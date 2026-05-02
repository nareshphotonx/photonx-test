'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, BookOpen, BriefcaseBusiness, Eye, EyeOff, MessageSquare, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import { Button, FieldError, Input, Label } from '@/components/ui';
import { login } from '@/lib/auth';
import { getApiErrorMessage } from '@/lib/api';
import { landingFor } from '@/lib/roles';

const schema = z.object({
  tenantSlug: z.string().min(1, 'Workspace is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantSlug: 'photonx-default', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const result = await login(values);
      toast.success('Welcome back!');
      const next = params.get('next') ?? landingFor(result.user);
      router.replace(next);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 lg:p-12">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[color:var(--color-brand-500)] to-[color:var(--color-brand-700)] text-white flex items-center justify-center font-bold">
            P
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">PhotonX</p>
            <p className="text-[10px] text-[color:var(--color-fg-muted)] leading-none mt-1">WorkOS</p>
          </div>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
            <p className="text-sm text-[color:var(--color-fg-muted)] mt-1.5">
              Enter your credentials to continue. Don&apos;t have an account?{' '}
              <a href="#" className="text-[color:var(--color-primary)] font-medium hover:underline">
                Contact sales
              </a>
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="tenantSlug" required>
                  Workspace
                </Label>
                <Input id="tenantSlug" {...register('tenantSlug')} placeholder="acme-india" autoCapitalize="none" />
                <FieldError>{errors.tenantSlug?.message}</FieldError>
              </div>

              <div>
                <Label htmlFor="email" required>
                  Email
                </Label>
                <Input
                  id="email"
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  inputMode="email"
                />
                <FieldError>{errors.email?.message}</FieldError>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password" required>
                    Password
                  </Label>
                  <a href="#" className="text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-2)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError>{errors.password?.message}</FieldError>
              </div>

              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                Sign in
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>

              <p className="text-xs text-[color:var(--color-fg-muted)] text-center pt-2">
                Demo credentials &middot; <span className="font-mono text-[color:var(--color-fg)]">superadmin@photonx.dev</span> / <span className="font-mono text-[color:var(--color-fg)]">Admin@12345</span>
              </p>
            </form>
          </div>
        </div>

        <p className="text-xs text-[color:var(--color-fg-subtle)] text-center">© {new Date().getFullYear()} PhotonX Tech. All rights reserved.</p>
      </div>

      {/* Right — feature panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[color:var(--color-brand-700)] via-[color:var(--color-brand-800)] to-[color:var(--color-brand-900)] text-white">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage:
            'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 50%)',
        }} />

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight">
              The work OS your team actually uses.
            </h2>
            <p className="text-white/80 mt-4 leading-relaxed">
              Projects, tasks, attendance, leave, expenses and an AI assistant — all in one place. Plus everyone&apos;s favorite app: WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <FeatureCard icon={BriefcaseBusiness} title="Projects & Tasks" hint="Kanban, lists, dependencies" />
            <FeatureCard icon={MessageSquare} title="WhatsApp-first" hint="Punch in, apply leave by chat" />
            <FeatureCard icon={Sparkles} title="AI Assistant" hint="Ask anything about your workspace" />
            <FeatureCard icon={TrendingUp} title="KPI Dashboards" hint="Real-time team performance" />
            <FeatureCard icon={BookOpen} title="Knowledge base" hint="Tenant-safe document RAG" />
            <FeatureCard icon={BriefcaseBusiness} title="Full HRMS" hint="Attendance, leave, expenses" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-4">
      <Icon className="h-5 w-5 mb-2 opacity-90" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-white/70 mt-0.5">{hint}</p>
    </div>
  );
}
