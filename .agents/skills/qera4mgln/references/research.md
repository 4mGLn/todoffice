# Research grounding and attribution

**Paper:** Jinhu Qi, Minda Hu, Wentao Zhang, Zixing Song and Irwin King, *Ask Before You Answer: A Question-Driven Evidence Reasoning Architecture (QERA) for In-Context Learning*, arXiv:2610.35083v2 (October 27, 2026). https://arxiv.org/html/2610.35083v2

**Original algorithm:** Ask extracts requirement checklist O and typed information needs N. Code filters produce Q; the same Q guides Answer and Check. Check grounds claims with quotations, a code audit checks evidence and arithmetic, and guarded local Repair may produce a better final answer.

**What the experiments support:** The paper evaluates QERA on CL-bench Life, where the complete architecture improves average solving rate (21.0% versus 14.6% direct answer across four models), while a stage-wise ablation shows that much of the benefit arises *before* the answer. More calls do not guarantee improvement, and CHECK/REPAIR can worsen full-task solving on some settings.

**What this package adds:** Vendor-neutral Agent Skills packaging, an explicit tool-authorization boundary, agent workflow for real artifacts, modular Python helpers, OpenAI-compatible optional text driver, demos, local tests, installation script, and data contract templates.

**Reproducibility caveat:** This is an independently authored, QERA-inspired reusable skill, not the authors' official code or an exact reproduction of their prompts/thresholds or benchmark. Its Python helpers validate only limited observable properties; users should run their own domain-specific evaluations.

**Format standard:** https://agentskills.io/specification . `SKILL.md` metadata includes required `name` and `description`, and the remainder of the skill is loaded on demand by compatible hosts.
