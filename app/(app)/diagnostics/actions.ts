// File: app/(app)/diagnostics/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  buildWorkspaceReport,
  normalizeReportRange,
  reportRanges
} from '@/lib/reports/workspace-report';

type Status = 'PASS' | 'WARN' | 'FAIL';
type Result = {
  id: string;
  name: string;
  status: Status;
  detail: string;
  recommendation?: string;
};
type SupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function sanitizeError(error: SupabaseError | null) {
  if (!error) return 'No error details available.';
  return [
    `code=${error.code || 'unknown'}`,
    `message=${error.message || 'unknown'}`,
    `details=${error.details || 'none'}`,
    `hint=${error.hint || 'none'}`
  ]
    .join('; ')
    .slice(0, 1000);
}

async function safeLog(
  supabase: any,
  userId: string,
  code: string,
  area: string,
  message: string
) {
  await supabase.from('diagnostic_events').insert({
    user_id: userId,
    code,
    area,
    route: '/diagnostics',
    severity: 'error',
    message: message.slice(0, 500)
  });
}

export async function runSelfTest() {
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const results: Result[] = [];
  const add = (
    id: string,
    name: string,
    status: Status,
    detail: string,
    recommendation?: string
  ) => results.push({ id, name, status, detail, recommendation });

  const fail = async (
    id: string,
    name: string,
    error: SupabaseError,
    recommendation: string
  ) => {
    const detail = sanitizeError(error);
    add(id, name, 'FAIL', detail, recommendation);
    await safeLog(supabase, user.id, id, 'self-test', detail);
  };

  add('AUTH-001', 'Authentication', 'PASS',
    'Authenticated user session is available.');

  const checks = [
    ['DB-001', 'Debug Sessions', 'debug_sessions', 'id, archived_at',
      'Verify the archive migration and RLS policies.'],
    ['DB-002', 'Observations', 'observations', 'id, debug_session_id',
      'Verify the observations schema and RLS policies.'],
    ['DB-003', 'Components', 'components', 'id, title',
      'Verify the components schema and RLS policies.'],
    ['DB-004', 'Component Evidence', 'component_evidence',
      'component_id, observation_id',
      'Verify the component_evidence schema and RLS policies.'],
    ['LOG-001', 'Diagnostic Events', 'diagnostic_events',
      'id, code, severity, created_at',
      'Apply the diagnostic_events migration.']
  ] as const;

  for (const [id, name, table, columns, recommendation] of checks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      const detail = sanitizeError(error);
      add(id, name, 'FAIL', detail, recommendation);
      if (id !== 'LOG-001') {
        await safeLog(supabase, user.id, id, 'self-test', detail);
      }
    } else {
      add(id, name, 'PASS', `${table} is readable with required columns.`);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    await fail('AUTH-002', 'Profile access', profileError,
      'Verify profile RLS and account bootstrap.');
  } else {
    add('AUTH-002', 'Profile access', profile ? 'PASS' : 'WARN',
      profile ? 'Authenticated profile is readable.' : 'No profile row found.',
      profile ? undefined : 'Verify account bootstrap.');
  }

  const { data: workspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1);
  if (workspaceError) {
    await fail('AUTH-003', 'Workspace access', workspaceError,
      'Verify workspace RLS and account bootstrap.');
  } else {
    add('AUTH-003', 'Workspace access', workspaces?.length ? 'PASS' : 'WARN',
      workspaces?.length ? 'An accessible workspace is available.' :
        'No accessible workspace found.');
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1);
  if (membershipError) {
    await fail('AUTH-004', 'Workspace membership access', membershipError,
      'Verify workspace_members RLS policies.');
  } else {
    add('AUTH-004', 'Workspace membership access',
      memberships?.length ? 'PASS' : 'WARN',
      memberships?.length ? 'Workspace membership is readable.' :
        'No workspace membership found.');
  }

  const { data: experiments, error: experimentsError } = await supabase
    .from('experiments')
    .select('id, workspace_id')
    .limit(1);
  if (experimentsError) {
    await fail('EXP-101', 'Experiments table access', experimentsError,
      'Verify experiments schema and RLS policies.');
  } else {
    add('EXP-101', 'Experiments table access', 'PASS',
      experiments?.length ? 'An accessible experiment was found.' :
        'Experiments table is readable; no experiment is available for link tests.');
  }

  const { error: componentsError } = await supabase
    .from('components')
    .select('id, workspace_id')
    .limit(1);
  if (componentsError) {
    await fail('EXP-102', 'Components table access', componentsError,
      'Verify components schema and RLS policies.');
  } else {
    add('EXP-102', 'Components table access', 'PASS',
      'Components table is readable.');
  }

  const { data: linkRows, error: linksError } = await supabase
    .from('experiment_components')
    .select('experiment_id, component_id')
    .limit(20);
  if (linksError) {
    await fail('EXP-103', 'Experiment-component table access', linksError,
      'Verify the experiment_components migration and RLS policy.');
  } else {
    add('EXP-103', 'Experiment-component table access', 'PASS',
      'experiment_components and both relationship columns are readable.');
  }

  const experiment = experiments?.[0];
  if (!experiment) {
    add('EXP-104', 'Experiment workspace component lookup', 'WARN',
      'Skipped because no accessible experiment exists.',
      'Create an experiment and rerun Self-Test.');
    add('EXP-105', 'Experiment linked-ID lookup', 'WARN',
      'Skipped because no accessible experiment exists.',
      'Create an experiment and rerun Self-Test.');
    add('EXP-106', 'Experiment/component workspace integrity', 'WARN',
      'Skipped because no accessible experiment exists.',
      'Create an experiment and rerun Self-Test.');
  } else {
    const { data: workspaceComponents, error: workspaceComponentsError } =
      await supabase
        .from('components')
        .select('id, workspace_id')
        .eq('workspace_id', experiment.workspace_id)
        .limit(20);
    if (workspaceComponentsError) {
      await fail('EXP-104', 'Experiment workspace component lookup',
        workspaceComponentsError,
        'Verify components RLS for the experiment workspace.');
    } else {
      add('EXP-104', 'Experiment workspace component lookup', 'PASS',
        `${workspaceComponents?.length ?? 0} accessible component(s) sampled.`);
    }

    const { data: experimentLinks, error: experimentLinksError } =
      await supabase
        .from('experiment_components')
        .select('experiment_id, component_id')
        .eq('experiment_id', experiment.id)
        .limit(20);
    if (experimentLinksError) {
      await fail('EXP-105', 'Experiment linked-ID lookup',
        experimentLinksError,
        'Verify experiment_components RLS for the selected experiment.');
    } else {
      add('EXP-105', 'Experiment linked-ID lookup', 'PASS',
        `${experimentLinks?.length ?? 0} linked component ID(s) sampled.`);
    }

    if (!workspaceComponentsError && !experimentLinksError) {
      const workspaceIds = new Set(
        (workspaceComponents ?? []).map((component) => component.id)
      );
      const mismatches = (experimentLinks ?? []).filter(
        (link) => !workspaceIds.has(link.component_id)
      ).length;
      add('EXP-106', 'Experiment/component workspace integrity',
        mismatches ? 'FAIL' : 'PASS',
        mismatches ? `${mismatches} accessible link(s) do not match the experiment workspace.` :
          'Accessible experiment-component links match the experiment workspace.',
        mismatches ? 'Review experiment_components integrity and RLS.' : undefined);
      if (mismatches) {
        await safeLog(supabase, user.id, 'EXP-106', 'self-test',
          `${mismatches} experiment-component workspace mismatch(es).`);
      }
    } else {
      add('EXP-106', 'Experiment/component workspace integrity', 'WARN',
        'Skipped because prerequisite link or component lookup failed.');
    }
  }

  const reportChecks = [
    ['RPT-101', 'Weekly Reviews reporting source', 'weekly_reviews',
      'id, workspace_id, created_at'],
    ['RPT-102', 'Releases reporting source', 'releases',
      'id, workspace_id, released_at'],
    ['RPT-103', 'Release Changes reporting source', 'release_changes',
      'id, release_id, created_at'],
    ['RPT-104', 'Tags reporting source', 'tags', 'id, workspace_id, name'],
    ['RPT-105', 'Component Tags reporting source', 'component_tags',
      'component_id, tag_id'],
    ['RPT-106', 'Component Links reporting source', 'component_links',
      'id, source_component_id, relationship_type, created_at'],
    ['RPT-107', 'Experiments reporting source', 'experiments',
      'id, workspace_id, status, conclusion, created_at']
  ] as const;

  for (const [id, name, table, columns] of reportChecks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      await fail(id, name, error,
        `Verify ${table} schema, grants, and RLS policies.`);
    } else {
      add(id, name, 'PASS', `${table} is readable for aggregate reporting.`);
    }
  }

  const diagnosticWorkspace = workspaces?.[0];
  if (diagnosticWorkspace) {
    const { error: reportSourceError } = await supabase
      .from('components')
      .select('id,type,status,confidence,created_at')
      .eq('workspace_id', diagnosticWorkspace.id)
      .limit(1);
    if (reportSourceError) {
      await fail('RPT-108', 'Workspace report-source query', reportSourceError,
        'Verify components reporting fields and workspace RLS.');
    } else {
      add('RPT-108', 'Workspace report-source query', 'PASS',
        'Workspace-scoped aggregate report sources are readable.');
    }
  } else {
    add('RPT-108', 'Workspace report-source query', 'WARN',
      'Skipped because no accessible workspace exists.');
  }

  const diagnosticWorkspace = workspaces?.[0];
  const expectedComponentTypes = new Set([
    'setting', 'rule', 'assumption', 'need', 'protective_strategy',
    'strength', 'warning_sign', 'recovery_method', 'resource_requirement',
    'operating_condition'
  ]);
  const expectedComponentStatuses = new Set([
    'observed', 'candidate', 'testing', 'confirmed', 'adopted',
    'deprecated', 'retired'
  ]);
  const expectedConfidence = new Set(['low', 'medium', 'high']);
  const expectedEvidenceStrength = new Set(['weak', 'moderate', 'strong']);
  const expectedRelationshipTypes = new Set([
    'triggers', 'requires', 'supports', 'conflicts_with',
    'protects_against', 'amplifies', 'reduces', 'compensates_for',
    'replaced_by'
  ]);
  const expectedExperimentStatuses = new Set([
    'draft', 'active', 'completed', 'abandoned'
  ]);
  const expectedConclusions = new Set([
    'supported', 'mixed', 'not_supported', 'inconclusive'
  ]);
  const expectedChangeTypes = new Set([
    'added', 'modified', 'adopted', 'deprecated', 'retired', 'restored'
  ]);

  const currentMembership = memberships?.[0];
  add(
    'AUTH-005',
    'Workspace membership role',
    currentMembership && ['owner', 'member'].includes(currentMembership.role)
      ? 'PASS'
      : 'FAIL',
    currentMembership
      ? 'The accessible membership uses a supported role.'
      : 'No accessible workspace membership role was found.',
    currentMembership ? undefined : 'Verify workspace membership bootstrap.'
  );

  const { data: componentRows, error: componentRowsError } = await supabase
    .from('components')
    .select('id,workspace_id,type,title,status,confidence,created_at');
  if (componentRowsError) {
    await fail('CMP-201', 'Component schema compatibility', componentRowsError,
      'Verify component reporting fields and RLS.');
  } else {
    add('CMP-201', 'Component schema compatibility', 'PASS',
      'Required component fields are readable.');
    const invalidEnums = (componentRows ?? []).filter((row: any) =>
      !expectedComponentTypes.has(row.type) ||
      !expectedComponentStatuses.has(row.status) ||
      (row.confidence != null && !expectedConfidence.has(row.confidence))
    ).length;
    add('CMP-202', 'Component enum compatibility',
      invalidEnums ? 'FAIL' : 'PASS',
      invalidEnums
        ? `${invalidEnums} accessible component row(s) use unexpected enum values.`
        : 'Accessible component enum values match the current schema.');
  }

  const { data: evidenceRows, error: evidenceRowsError } = await supabase
    .from('component_evidence')
    .select('id,component_id,observation_id,strength,created_at');
  if (evidenceRowsError) {
    await fail('CMP-203', 'Evidence schema compatibility', evidenceRowsError,
      'Verify component_evidence fields and RLS.');
  } else {
    const invalidEvidence = (evidenceRows ?? []).filter((row: any) =>
      !row.component_id || !row.observation_id ||
      (row.strength != null && !expectedEvidenceStrength.has(row.strength))
    ).length;
    add('CMP-203', 'Evidence schema compatibility',
      invalidEvidence ? 'FAIL' : 'PASS',
      invalidEvidence
        ? `${invalidEvidence} accessible evidence row(s) are invalid.`
        : 'Evidence identifiers and strength values are compatible.');
  }

  const { data: relationshipRows, error: relationshipRowsError } =
    await supabase
      .from('component_links')
      .select(
        'id,source_component_id,target_component_id,relationship_type,notes,created_at'
      );
  if (relationshipRowsError) {
    await fail('REL-201', 'Relationship schema compatibility',
      relationshipRowsError, 'Verify component_links fields and RLS.');
  } else {
    const invalidRelationships = (relationshipRows ?? []).filter((row: any) =>
      !row.source_component_id || !row.target_component_id ||
      row.source_component_id === row.target_component_id ||
      !expectedRelationshipTypes.has(row.relationship_type)
    ).length;
    add('REL-201', 'Relationship schema compatibility',
      invalidRelationships ? 'FAIL' : 'PASS',
      invalidRelationships
        ? `${invalidRelationships} accessible relationship row(s) are invalid.`
        : 'Relationship identifiers, directions, and types are compatible.');

    const componentWorkspace = new Map(
      (componentRows ?? []).map((row: any) => [row.id, row.workspace_id])
    );
    const workspaceMismatches = (relationshipRows ?? []).filter((row: any) =>
      componentWorkspace.get(row.source_component_id) !==
      componentWorkspace.get(row.target_component_id)
    ).length;
    add('REL-202', 'Relationship workspace integrity',
      workspaceMismatches ? 'FAIL' : 'PASS',
      workspaceMismatches
        ? `${workspaceMismatches} accessible relationship(s) cross workspaces.`
        : 'Accessible relationship endpoints share a workspace.');
  }

  if (diagnosticWorkspace) {
    const [outgoingRead, incomingRead] = await Promise.all([
      supabase.from('component_links').select('id')
        .in('source_component_id',
          (componentRows ?? []).filter((row: any) =>
            row.workspace_id === diagnosticWorkspace.id).map((row: any) => row.id))
        .limit(1),
      supabase.from('component_links').select('id')
        .in('target_component_id',
          (componentRows ?? []).filter((row: any) =>
            row.workspace_id === diagnosticWorkspace.id).map((row: any) => row.id))
        .limit(1)
    ]);
    const directionError = outgoingRead.error ?? incomingRead.error;
    if (directionError) {
      await fail('REL-203', 'Incoming and outgoing relationship queries',
        directionError, 'Verify relationship direction queries and RLS.');
    } else {
      add('REL-203', 'Incoming and outgoing relationship queries', 'PASS',
        'Incoming and outgoing relationship reads are available.');
    }
  } else {
    add('REL-203', 'Incoming and outgoing relationship queries', 'WARN',
      'Skipped because no accessible workspace exists.');
  }

  const { data: experimentRows, error: experimentRowsError } = await supabase
    .from('experiments')
    .select(
      'id,workspace_id,title,hypothesis,variable_change,status,conclusion,created_at'
    );
  if (experimentRowsError) {
    await fail('EXP-107', 'Experiment enum compatibility', experimentRowsError,
      'Verify experiment fields and RLS.');
  } else {
    const invalidExperiments = (experimentRows ?? []).filter((row: any) =>
      !expectedExperimentStatuses.has(row.status) ||
      (row.conclusion != null && !expectedConclusions.has(row.conclusion))
    ).length;
    add('EXP-107', 'Experiment enum compatibility',
      invalidExperiments ? 'FAIL' : 'PASS',
      invalidExperiments
        ? `${invalidExperiments} accessible experiment row(s) use invalid enums.`
        : 'Experiment status and conclusion values are compatible.');
  }

  const { data: experimentObservationRows, error: experimentObservationError } =
    await supabase
      .from('experiment_observations')
      .select('experiment_id,observation_id');
  if (experimentObservationError) {
    await fail('EXP-108', 'Experiment observation links',
      experimentObservationError,
      'Verify experiment_observations fields, grants, and RLS.');
  } else {
    const invalidLinks = (experimentObservationRows ?? []).filter((row: any) =>
      !row.experiment_id || !row.observation_id).length;
    add('EXP-108', 'Experiment observation links',
      invalidLinks ? 'FAIL' : 'PASS',
      invalidLinks
        ? `${invalidLinks} accessible experiment-observation link(s) are incomplete.`
        : 'Experiment-observation identifiers are present.');
  }

  const { data: reviewRows, error: reviewRowsError } = await supabase
    .from('weekly_reviews')
    .select('id,workspace_id,period_start,period_end,created_at');
  if (reviewRowsError) {
    await fail('REV-201', 'Weekly Review schema compatibility', reviewRowsError,
      'Verify weekly_reviews fields and RLS.');
  } else {
    const invalidRanges = (reviewRows ?? []).filter((row: any) =>
      row.period_end < row.period_start).length;
    add('REV-201', 'Weekly Review date integrity',
      invalidRanges ? 'FAIL' : 'PASS',
      invalidRanges
        ? `${invalidRanges} accessible review period(s) end before they start.`
        : 'Accessible Weekly Review periods are valid.');
  }

  const { data: releaseRows, error: releaseRowsError } = await supabase
    .from('releases')
    .select('id,workspace_id,version,released_at');
  const { data: releaseChangeRows, error: releaseChangeRowsError } =
    await supabase
      .from('release_changes')
      .select('id,release_id,component_id,change_type,created_at');
  if (releaseRowsError) {
    await fail('RLS-201', 'Release schema compatibility', releaseRowsError,
      'Verify releases fields and RLS.');
  } else {
    const emptyVersions = (releaseRows ?? []).filter((row: any) =>
      !String(row.version ?? '').trim()).length;
    add('RLS-201', 'Release schema compatibility',
      emptyVersions ? 'FAIL' : 'PASS',
      emptyVersions
        ? `${emptyVersions} accessible release version(s) are empty.`
        : 'Accessible release versions are populated.');
  }
  if (releaseChangeRowsError) {
    await fail('RLS-202', 'Release change schema compatibility',
      releaseChangeRowsError, 'Verify release_changes fields and RLS.');
  } else {
    const releaseById = new Map(
      (releaseRows ?? []).map((row: any) => [row.id, row])
    );
    const componentById = new Map(
      (componentRows ?? []).map((row: any) => [row.id, row])
    );
    const invalidChanges = (releaseChangeRows ?? []).filter((row: any) => {
      const release = releaseById.get(row.release_id) as any;
      const component = row.component_id ? componentById.get(row.component_id) as any : null;
      return !release || !expectedChangeTypes.has(row.change_type) ||
        (component && component.workspace_id !== release.workspace_id);
    }).length;
    add('RLS-202', 'Release change integrity',
      invalidChanges ? 'FAIL' : 'PASS',
      invalidChanges
        ? `${invalidChanges} accessible release change row(s) are invalid.`
        : 'Release changes have valid parents, types, and workspace links.');
  }

  const { data: tagRows, error: tagRowsError } = await supabase
    .from('tags').select('id,workspace_id,name');
  const { data: componentTagRows, error: componentTagRowsError } = await supabase
    .from('component_tags').select('component_id,tag_id');
  if (tagRowsError ?? componentTagRowsError) {
    await fail('TAG-201', 'Tag association compatibility',
      (tagRowsError ?? componentTagRowsError)!,
      'Verify tags and component_tags fields and RLS.');
  } else {
    const componentById = new Map(
      (componentRows ?? []).map((row: any) => [row.id, row.workspace_id])
    );
    const tagById = new Map(
      (tagRows ?? []).map((row: any) => [row.id, row.workspace_id])
    );
    const invalidTagLinks = (componentTagRows ?? []).filter((row: any) =>
      !row.component_id || !row.tag_id ||
      componentById.get(row.component_id) !== tagById.get(row.tag_id)
    ).length;
    add('TAG-201', 'Tag association compatibility',
      invalidTagLinks ? 'FAIL' : 'PASS',
      invalidTagLinks
        ? `${invalidTagLinks} accessible component-tag link(s) are invalid.`
        : 'Accessible component-tag links share a workspace.');
  }

  if (diagnosticWorkspace) {
    const dashboardQueries = await Promise.all([
      supabase.from('debug_sessions').select('id').eq('workspace_id', diagnosticWorkspace.id)
        .is('archived_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('components').select('id,type,status').eq('workspace_id', diagnosticWorkspace.id)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('experiments').select('id').eq('workspace_id', diagnosticWorkspace.id)
        .eq('status', 'active').order('created_at', { ascending: false }).limit(5),
      supabase.from('weekly_reviews').select('id').eq('workspace_id', diagnosticWorkspace.id)
        .order('period_end', { ascending: false }).limit(1),
      supabase.from('releases').select('id').eq('workspace_id', diagnosticWorkspace.id)
        .order('released_at', { ascending: false }).limit(1)
    ]);
    const dashboardError = dashboardQueries.find((query) => query.error)?.error;
    if (dashboardError) {
      await fail('DSH-201', 'Dashboard query prerequisites', dashboardError,
        'Verify Dashboard source fields and workspace RLS.');
    } else {
      add('DSH-201', 'Dashboard query prerequisites', 'PASS',
        'Dashboard source queries are readable.');
    }
  } else {
    add('DSH-201', 'Dashboard query prerequisites', 'WARN',
      'Skipped because no accessible workspace exists.');
  }

  const supportedRanges = ['7', '30', '90', 'all'];
  add('RPT-109', 'Report range compatibility',
    reportRanges.join(',') === supportedRanges.join(',') &&
      normalizeReportRange('invalid') === '30'
      ? 'PASS' : 'FAIL',
    'Report range options and invalid-range default were checked.');

  if (diagnosticWorkspace) {
    try {
      const smokeReport = await buildWorkspaceReport(
        supabase,
        diagnosticWorkspace,
        normalizeReportRange('30')
      );
      const validShape = Boolean(
        smokeReport.components?.byType && smokeReport.components?.byStatus &&
        smokeReport.evidence?.byStrength &&
        smokeReport.experiments?.byStatus &&
        typeof smokeReport.weeklyReviews?.count === 'number' &&
        Array.isArray(smokeReport.commonTags) &&
        smokeReport.relationships?.byType
      );
      add('RPT-110', '30-day report aggregation smoke test',
        validShape ? 'PASS' : 'FAIL',
        validShape
          ? 'The 30-day aggregate report returned the required sections.'
          : 'The aggregate report is missing required sections.');
    } catch (error) {
      await fail('RPT-110', '30-day report aggregation smoke test',
        error as SupabaseError,
        'Verify report source fields, grants, and workspace RLS.');
    }
  } else {
    add('RPT-110', '30-day report aggregation smoke test', 'WARN',
      'Skipped because no accessible workspace exists.');
  }

  const exportChecks = [
    ['XPT-201', 'Full export debug sessions', 'debug_sessions', 'id'],
    ['XPT-202', 'Full export observations', 'observations', 'id'],
    ['XPT-203', 'Full export components', 'components', 'id'],
    ['XPT-204', 'Full export component evidence', 'component_evidence', 'id'],
    ['XPT-205', 'Full export releases', 'releases', 'id'],
    ['XPT-206', 'Full export release changes', 'release_changes', 'id']
  ] as const;
  for (const [id, name, table, columns] of exportChecks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) await fail(id, name, error, `Verify ${table} export access.`);
    else add(id, name, 'PASS', 'Required export source is readable.');
  }
  add('XPT-207', 'Aggregate report export prerequisites',
    diagnosticWorkspace ? 'PASS' : 'WARN',
    diagnosticWorkspace
      ? 'Aggregate report export prerequisites are available.'
      : 'No accessible workspace is available for aggregate report export.');

  if (diagnosticWorkspace) {
    const readOne = await supabase.from('components').select('id,created_at')
      .eq('workspace_id', diagnosticWorkspace.id).order('id').limit(20);
    const readTwo = await supabase.from('components').select('id,created_at')
      .eq('workspace_id', diagnosticWorkspace.id).order('id').limit(20);
    const consistent = !readOne.error && !readTwo.error &&
      JSON.stringify(readOne.data ?? []) === JSON.stringify(readTwo.data ?? []);
    add('SCH-201', 'Non-destructive read consistency',
      consistent ? 'PASS' : 'WARN',
      consistent
        ? 'Repeated component reads returned the same identifiers and timestamps.'
        : 'Repeated reads differed or could not be completed safely.');
  } else {
    add('SCH-201', 'Non-destructive read consistency', 'WARN',
      'Skipped because no accessible workspace exists.');
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from('component_evidence')
    .select('component_id, observation_id');
  if (evidenceError) {
    add('INT-001', 'Evidence integrity', 'FAIL', sanitizeError(evidenceError),
      'Verify Evidence table access.');
  } else {
    const invalid = (evidence ?? []).filter(
      (row: any) => !row.component_id || !row.observation_id
    ).length;
    add('INT-001', 'Evidence integrity', invalid ? 'WARN' : 'PASS',
      invalid ? `${invalid} accessible evidence rows have missing relationship identifiers.` :
        'Evidence relationship identifiers are present.',
      invalid ? 'Review incomplete Evidence rows.' : undefined);
  }

  const { error: exportError } = await supabase
    .from('debug_sessions')
    .select('id')
    .limit(1);
  add('EXP-001', 'Export prerequisites', exportError ? 'FAIL' : 'PASS',
    exportError ? sanitizeError(exportError) :
      'Authenticated export source queries are available.',
    exportError ? 'Run database checks above first.' : undefined);

  return {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    results
  };
}
