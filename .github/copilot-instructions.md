# Copilot Workspace Guardrails

## Protected File Access

Do not access the file `start_private_network.bat`.
Do not access the file `to-do-in-this-project`.

For this file:
- Do not read it.
- Do not summarize it.
- Do not modify it.
- Do not include its contents in responses.

If a user asks for work that requires this file, ask for confirmation before proceeding and propose an alternative approach that avoids touching it.


## use these steps in every response:
1. Analyze the user's request and determine if it involves accessing the protected files.
2. If it does, ask the user for confirmation before proceeding and propose an alternative approach that avoids touching the protected files.
3. If the user confirms, proceed with the request while ensuring that the protected files are not accessed in any way.
4. If the user does not confirm, politely decline to perform the requested action and suggest other ways to assist them without accessing the protected files.
5. use mcp mempalace to store any relevant information that may be needed for future interactions, ensuring that it does not include any data from the protected files.
6. use mcp mempalace for every query, even if it does not involve the protected files, to maintain a comprehensive record of interactions and ensure that all relevant information is easily accessible for future reference.
7. MemPalace wake-up snapshot: On wake-up, call mempalace_status to load palace overview + AAAK spec. This ensures that the assistant has the most up-to-date information about the user's preferences, history, and any relevant facts that may be needed for interactions. It also allows the assistant to understand the current state of the user's memory palace and how to best utilize it for storing and retrieving information in future interactions.

Current palace overview:
- total_drawers: 755
- wings: advance_todo
- rooms: data (134), general (3), static (618)
- palace_path: C:\Users\Dipesh/.mempalace/palace

Protocol:
1. On wake-up, call mempalace_status to load palace overview + AAAK spec.
2. Before responding about any person, project, or past event, call mempalace_kg_query or mempalace_search first.
3. If unsure about a fact, say "let me check" and query the palace.
4. After each session, call mempalace_diary_write.
5. When facts change, invalidate the old fact and add the new one.

AAAK spec summary:
- 3-letter uppercase entity codes.
- Emotional markers like *warm*, *fierce*, *raw*, *bloom*.
- Pipe-separated structure with halls, wings, rooms, dates, counts, and importance.
- Example: FAM: ALC→♡JOR | 2D(kids): RIL(18,sports) MAX(11,chess+swimming) | BEN(contributor)

Full AAAK spec:
AAAK is a compressed memory dialect that MemPalace uses for efficient storage.
It is designed to be readable by both humans and LLMs without decoding.

FORMAT:
  ENTITIES: 3-letter uppercase codes. ALC=Alice, JOR=Jordan, RIL=Riley, MAX=Max, BEN=Ben.
  EMOTIONS: *action markers* before/during text. *warm*=joy, *fierce*=determined, *raw*=vulnerable, *bloom*=tenderness.
  STRUCTURE: Pipe-separated fields. FAM: family | PROJ: projects | ⚠: warnings/reminders.
  DATES: ISO format (2026-03-31). COUNTS: Nx = N mentions (e.g., 570x).
  IMPORTANCE: ★ to ★★★★★ (1-5 scale).
  HALLS: hall_facts, hall_events, hall_discoveries, hall_preferences, hall_advice.
  WINGS: wing_user, wing_agent, wing_team, wing_code, wing_myproject, wing_hardware, wing_ue5, wing_ai_research.
  ROOMS: Hyphenated slugs representing named ideas (e.g., chromadb-setup, gpu-pricing).

EXAMPLE:
  FAM: ALC→♡JOR | 2D(kids): RIL(18,sports) MAX(11,chess+swimming) | BEN(contributor)

Read AAAK naturally — expand codes mentally, treat *markers* as emotional context.
When WRITING AAAK: use entity codes, mark emotions, keep structure tight.

