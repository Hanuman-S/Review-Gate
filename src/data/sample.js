/**
 * Seeded demo manuscript.
 *
 * Deliberately synthetic rather than a real preprint: no licence question, and
 * the flaws can be placed precisely so the agent has real work to do on camera.
 * Every flaw below is one a competent reviewer would actually flag.
 *
 *   ABSTRACT      causal language ("causes", "leads to") from an observational design
 *   METHODS       n=48 for a claimed small effect; no multiple-comparison correction
 *                 across 12 outcomes; raters not blinded; exclusions after unblinding
 *   RESULTS       3/12 secondary outcomes significant, reported as if confirmatory;
 *                 CI spans a trivial effect; primary outcome switched from the
 *                 registered one (HARKing)
 *   DISCUSSION    "it is well known", "obviously", generalisation beyond the sample
 *   LIMITATIONS   omits the multiple-comparisons and switched-outcome problems
 *   FIGURES       Discussion cites "Figure 3", which the manuscript never presents —
 *                 a real reviewer catch, and something locate_figure_reference finds
 *
 * Swap in a real CC-BY preprint if you prefer, but check the flaws survive.
 */
export const SAMPLE_TITLE = 'Ambient noise and short-term recall in adults (synthetic demo manuscript)';

export const SAMPLE_TEXT = `ABSTRACT
Background noise is ubiquitous in modern workplaces, yet its cognitive costs remain poorly quantified. We investigated whether ambient noise affects short-term recall in healthy adults. Participants recalled fewer items under noisy conditions than quiet ones (p<0.05). These results demonstrate that ambient noise causes measurable memory impairment, and suggest that open-plan office designs lead to reduced cognitive performance.

METHODS
Adults were recruited from a single university campus via poster advertisement and randomised 1:1 to a quiet or a noisy condition (n=48). Sample size was chosen for feasibility within the study period. Recall was scored by two research assistants who were aware of condition assignment. Twelve outcome measures were collected, comprising one primary measure of immediate free recall and eleven secondary measures of delayed recall, recognition, subjective effort and self-reported distraction. No correction for multiple comparisons was applied. Four participants were excluded after data collection because their scores were considered implausible on inspection.

RESULTS
Mean immediate recall was 14.2% higher in the quiet condition (95% CI 2.1 to 26.3). The primary analysis was significant at p=0.043. Figure 1 shows the distribution of recall scores by condition. Three of the eleven secondary measures also reached significance. Delayed recognition showed the largest effect and is reported here as the principal finding, as it best captures durable memory formation. Table 1 summarises all twelve outcome measures. The remaining eight measures showed no significant difference between conditions and are not reported in detail.

DISCUSSION
It is well known that cognitive load increases under distraction, and our findings are consistent with this literature. The observed differences are due to attentional narrowing under acoustic stress. Obviously these effects would generalise to workplace settings, where noise exposure is sustained rather than brief. Employers should therefore reconsider open-plan layouts. As shown in Figure 3, the magnitude of the effect we observed suggests that noise reduction could yield substantial productivity gains across the wider working population.

LIMITATIONS
The sample was drawn from a single institution and skewed young, which may limit generalisability to older adults. Noise exposure in the laboratory was brief compared to real-world conditions. Future work should examine longer exposures in naturalistic environments.
`;
