# Prepare shortlisted applications

Get a current `workflow --mode shortlist` packet from the same store used by the app. Use a new private output path. The packet lists active Shortlisted roles and whether resumes/preparation need work. Closed, excluded, manually archived and Passed roles aren't automatic preparation targets.

## Resume

Read the full JD and confirmed experience. Use `draft` for a starting version when needed, then tailor the language with the host model. Preserve truthful titles, dates, ownership and metrics. The deterministic draft is just a starting point; it does not replace your reading of the JD.

For each meaningful edit, explain the requirement, selected evidence, wording or ordering change and remaining gap in `adjustments`. Save through the `resume` action with the exact current JD hash and confirmed capability IDs. Don't regenerate a current pending/approved version just to run the workflow again. Requested changes and changed sources justify a new version.

Produce a PDF with the supplied renderer or another available renderer whose output you can inspect. Check its layout and extracted text. Default to a concise ATS-readable resume; use one A4 page when the user's content fits without making it unreadable. Follow the user's requested format when different. Save PDFs in private storage and give the user a real accessible file/link. The workbench offers an authenticated print view; it does not archive original PDF bytes. If rendering or delivery fails, report it as incomplete. Do not mark the resume approved yourself.

## Interview preparation

After saving the resume, refresh the shortlist packet to obtain `preparationAction` with the current JD hash, resume version and content hash. Use confirmed capability IDs and write a Markdown preparation document containing:

- Positioning for this particular role.
- Project examples: context, personal responsibility, decision/alternative, implementation, observed result and limitations. Cite the original evidence; missing measurements stay missing.
- Possible employer concerns, each tied to a JD requirement, an answer outline, the supporting example, an honest gap and practice follow-ups. Label concerns as hypotheses, not employer feedback.
- Questions to ask the employer and concrete next steps.

Save a `preparation` action using that binding and content. The store keeps the selected capability snapshot and a new version. The app shows the document and flags it stale when JD/resume/evidence changes. Add new preparation tasks with `done:false`; don't change existing completion states. Preparation and resume approval are independent of Applied.

This method draws on AIPMAndy / AI 酋长 Andy's [How to Get an Offer](https://github.com/AIPMAndy/how-to-get-offer), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The adaptation uses user-specific roles/languages, cited claims, separate eligibility/decisions, and versioned workspace records. No upstream application code is included.

Run `work-check` against the original packet after saving. Check the app's actual resume and preparation views as well. The command validates persisted records and bindings; it cannot prove a PDF was inspected or an answer is truthful. Tell the user what changed for each role and leave the package pending their review.

If asked to practice, ask one interview question at a time and assess relevance, reasoning, clarity and responsibility boundaries. After an actual interview, distinguish user recollection, verbatim feedback and your interpretation. Do not infer rejection reasons or calculate conversion rates from current buckets or resume counts.
