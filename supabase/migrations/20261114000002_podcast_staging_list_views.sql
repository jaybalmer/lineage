-- Podcast archive staging, Phase 1: list columns on the two stats views.
--
-- Appends the node and episode columns to the stats views created in
-- 20261114000001, so the admin Nodes and Episodes tabs can filter, sort and
-- paginate in ONE SQL query (PostgREST cannot join a view to a table without a
-- foreign key). CREATE OR REPLACE VIEW only appends columns; the existing ones
-- keep their names and order. Views on staging tables created the same day;
-- security_invoker and the anon/authenticated revokes are restated.

create or replace view public.podcast_staging_node_stats
with (security_invoker = true) as
select n.id,
       count(distinct s.episode_id)                                  as episode_count,
       count(distinct s.id)                                          as story_count,
       count(distinct s.id) filter (where s.decision <> 'trimmed')  as kept_story_count,
       count(m.id) filter (where m.inferred)                         as inferred_count,
       count(m.id)                                                   as mention_count,
       n.subject_type,
       n.name,
       n.normalized_name,
       n.resolution,
       n.subject_id,
       n.candidates,
       n.flags,
       n.decision,
       n.heard_as,
       n.merged_into
from public.podcast_staging_nodes n
left join public.podcast_staging_mentions m on m.node_id = n.id
left join public.podcast_staging_stories  s on s.id = m.story_id
group by n.id;

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
       e.wave
from public.podcast_staging_episodes e
left join public.podcast_staging_stories  s on s.episode_id = e.id
left join public.podcast_staging_mentions m on m.story_id = s.id
group by e.id;

revoke all on public.podcast_staging_node_stats    from anon, authenticated;
revoke all on public.podcast_staging_episode_stats from anon, authenticated;
