#!/usr/bin/env tsx

import 'dotenv/config';
import { createInviteWithoutAuth } from '@/lib/actions/invite';
import {
  DEFAULT_PLAN_KEY,
  PLAN_INTERVALS,
  PLAN_KEYS,
  resolvePlanInterval,
  type PlanInterval,
  type PlanKey,
} from '@/lib/plans';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    email: { type: 'string', short: 'e' },
    expires: { type: 'string', short: 'x', default: '30' },
    maxUses: { type: 'string', short: 'm', default: '1' },
    plan: { type: 'string', short: 'p' },
    interval: { type: 'string', short: 'i' },
  },
});

async function main() {
  const email = values.email;
  const expiresInDays = parseInt(values.expires || '30', 10);
  const maxUses = parseInt(values.maxUses || '1', 10);
  const planKey = values.plan ? (values.plan.toLowerCase() as PlanKey) : undefined;
  const planInterval = values.interval
    ? (values.interval.toLowerCase() as PlanInterval)
    : undefined;

  if (planInterval && !planKey) {
    console.error('✗ Error: --interval requires --plan');
    process.exit(1);
  }

  if (planKey && !PLAN_KEYS.includes(planKey)) {
    console.error(`✗ Error: Invalid plan. Use: ${PLAN_KEYS.join(', ')}`);
    process.exit(1);
  }

  if (planInterval && !PLAN_INTERVALS.includes(planInterval)) {
    console.error(`✗ Error: Invalid interval. Use: ${PLAN_INTERVALS.join(', ')}`);
    process.exit(1);
  }

  console.log('Creating invite code...');
  console.log('Email restriction:', email || 'None');
  console.log('Expires in:', expiresInDays, 'days');
  console.log('Max uses:', maxUses);
  if (planKey) {
    if (planKey === DEFAULT_PLAN_KEY) {
      console.log('Plan:', planKey);
    } else {
      console.log('Plan:', `${planKey} (${resolvePlanInterval(planInterval)})`);
    }
  } else {
    console.log('Plan:', DEFAULT_PLAN_KEY);
  }
  console.log('');

  const result = await createInviteWithoutAuth({
    email,
    expiresInDays,
    maxUses,
    planKey,
    planInterval,
    createdById: null,
  });

  if (result.success) {
    console.log('✓ Invite code created successfully!');
    console.log('');
    console.log('Code:', result.code);
    console.log('');
    console.log('Share this code with the user to allow them to sign up.');
  } else {
    console.error('✗ Failed to create invite:', result.error);
    process.exit(1);
  }
}

main();
