-- Podcast archive staging: story status counts on the Nodes tab.
--
-- Appends per-decision story counts to podcast_staging_node_stats, with the
-- same names and meanings as the episode view gained in 20261115000001, so the
-- "By person or node" list can show pending, approved, ready to publish,
-- published, held and trimmed stories per node.
--
-- CREATE OR REPLACE VIEW only appends columns; every existing column keeps its
-- name, order and meaning.
--
-- ready_count mirrors exclusionReason() in src/lib/podcast-staging-publish.ts
-- for this node: an approved story whose mention of this node is not dropped
-- and not yet published, on an approved, unmerged node.

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
       n.merged_into,
       count(distinct s.id) filter (where s.decision = 'pending')        as pending_count,
       count(distinct s.id) filter (where s.decision = 'approved')       as approved_count,
       count(distinct s.id) filter (where s.decision = 'hold_sensitive') as held_count,
       count(distinct s.id) filter (where s.decision = 'trimmed')        as trimmed_count,
       count(distinct s.id) filter (
         where s.decision = 'approved'
           and m.decision = 'inherit'
           and m.published_mention_id is null
           and n.decision = 'approved'
           and n.merged_into is null
       )                                                                  as ready_count,
       count(distinct s.id) filter (where m.published_mention_id is not null) as published_story_count
from public.podcast_staging_nodes n
left join public.podcast_staging_mentions m on m.node_id = n.id
left join public.podcast_staging_stories  s on s.id = m.story_id
group by n.id;

revoke all on public.podcast_staging_node_stats from anon, authenticated;
