-- Podcast archive staging: story status counts on the Episodes tab.
--
-- Appends per-decision story counts to podcast_staging_episode_stats so the
-- Episodes list can show, per episode, how many stories are pending, approved,
-- held as sensitive, trimmed, ready to publish and already published.
--
-- CREATE OR REPLACE VIEW only appends columns; every existing column keeps its
-- name, order and meaning. The node join is one row per mention, so the
-- existing counts are unchanged.
--
-- ready_count mirrors exclusionReason() in src/lib/podcast-staging-publish.ts:
-- an approved story with at least one mention that is not dropped, whose node
-- is approved and not merged, and that has not been published yet. (Approval
-- already requires approveBlocker() to pass.)

create or replace view public.podcast_staging_episode_stats
with (security_invoker = true) as
select e.id,
       count(distinct s.id)                                          as story_count,
       count(distinct s.id) filter (where s.decision = 'trimmed')   as trimmed_count,
       count(m.id)                                                   as mention_count,
       count(m.id) filter (where m.inferred)                         as inferred_count,
       e.archive_label,
       e.guest,
       e.episode_name,
       e.proposed_episode_number,
       e.air_date,
       e.video_id,
       e.status,
       e.episode_event_id,
       e.series_note,
       e.wave,
       count(distinct s.id) filter (where s.decision = 'pending')        as pending_count,
       count(distinct s.id) filter (where s.decision = 'approved')       as approved_count,
       count(distinct s.id) filter (where s.decision = 'hold_sensitive') as held_count,
       count(distinct s.id) filter (
         where s.decision = 'approved'
           and m.decision = 'inherit'
           and m.published_mention_id is null
           and n.decision = 'approved'
           and n.merged_into is null
       )                                                                  as ready_count,
       count(distinct s.id) filter (where m.published_mention_id is not null) as published_story_count
from public.podcast_staging_episodes e
left join public.podcast_staging_stories  s on s.episode_id = e.id
left join public.podcast_staging_mentions m on m.story_id = s.id
left join public.podcast_staging_nodes    n on n.id = m.node_id
group by e.id;

revoke all on public.podcast_staging_episode_stats from anon, authenticated;
