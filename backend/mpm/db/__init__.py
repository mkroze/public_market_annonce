"""Persistence: the connection factory and schema (`database`) and the
admin-editable settings stored in `app_settings` (`settings`).

`settings` is runtime configuration read from the database; `core.config` is
boot-time configuration read from the environment. The split is enforced by
dependency direction: `settings` imports `database`, `core.config` imports
nothing.
"""
