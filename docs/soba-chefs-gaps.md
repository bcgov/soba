# SOBA / CHEFS Gaps: Form rendering & submitter experience

**Context:** This is written from the perspective of enabling **“as a submitter, render my form.”** The current work prioritizes plumbing (frontend ↔ backend ↔ Form.io) rather than the CHEFS embedded web component for the Form.io renderer, which was deferred as too heavy for an early slice.

---

## What exists vs. what’s missing (near term)

### Renderer implementation

The PR **does not** use the CHEFS embedded web component for rendering. That was an intentional scope cut so effort could go to integration and wiring first.

### User journeys

There is **no end-to-end user flow** yet—for **form designers / form managers**, **submitters**, or **admins**. CHEFS also does not currently offer a full **submitter** experience, which is a product gap worth naming explicitly.

A minimal **submitter** story usually looks like: they receive a link → open the form → fill and submit → optionally email themselves a copy, print, or open a **list of their submissions for that form**. Anything beyond that can come later, but that core loop should be designed and built deliberately.

### Path to “I can open a form and submit”

To get from sign-in to a rendered form, several layers need definition or implementation:

1. **Public entry**  
   Someone needs to design (even roughly) what the **public landing** experience is for SOBA—how anonymous or link-based access works, and how it ties into sign-in when required.

2. **Identity & workspace context**  
   After sign-in, users need to know **which workspace (tenant) they are in**. Today this may be implicit; longer term it could be carried in tokens when users arrive from other CSTAR products, but that is not the near-term path. For **personal SOBA**, explicit **workspace selection** is important because a person may have roles in many workspaces.

3. **Who may create a “personal” workspace**  
   **CSTAR** is expected to govern who can create **tenants**; SOBA needs **parallel rules** for who can create a **personal / local workspace**. Current behaviour creates a tenant on sign-in while only **IDIR + MFA** is allowed, which limits risk. As soon as **additional identity providers** are enabled, **creation of workspaces must be gated**—ideally driven by **configuration** (e.g. identity provider, claims in the token, or other policy), not ad hoc checks scattered through the app.

4. **Broader sign-in options**  
   Allowing more IdPs is largely **SSO client configuration**, but the product also needs a **UX for choosing** which sign-in method to use when more than one is available.

5. **Post–workspace-selection experience**  
   After workspace context is clear, users need a **landing page** and **navigation** that are actually specified—for example:
   - A **catalog of forms** with a simple indication of access (e.g. submit-only vs admin / reviewer / designer).
   - Routes into **manage** vs **submit**.
   - Optionally a **tasks / assignments** view (e.g. submissions assigned to you for review).

**Bottom line:** Most of the above is **missing or incomplete** relative to the goal of a submitter reliably reaching a **rendered form** and completing a submission.

---

## Longer term

### Form.io via web components

**Web components for all Form.io surfaces** is a strategic direction worth considering. The **form renderer** path started in CHEFS is the easier lift for SOBA; the **designer** should be evaluated on the same basis.

**Rationale:** Supporting **multiple Form.io major versions or skins** in one UX (e.g. v5, v4, v4 with CoCo components) is awkward if everything shares one app-level Form.io dependency—you generally cannot load **multiple Form.io versions** as normal shared libraries in one SPA. **Web components** isolate their own runtime assets and can reduce that collision.

**Trade-off:** Web components are **more work for the team** to build and maintain, and integration patterns (events, styling, auth context) need discipline.
