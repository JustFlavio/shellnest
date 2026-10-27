import { HostEditor, IdentityEditor, KeyEditor } from "./Editors";
import { GroupEditor } from "./GroupEditor";
import { useApp } from "./app-context";

export function EditorPanels() {
  const {
    vault: { view, busy, error, invokeScoped },
    library: {
      hostForm,
      setHostForm,
      groupForm,
      setGroupForm,
      identityForm,
      setIdentityForm,
      keyForm,
      setKeyForm,
      hostAutosave,
      newIdentityForm,
      newKeyForm,
      closeHostEditor,
      submitHostEditor,
      newFolderFromHost,
      closeGroupEditor,
      saveGroup,
      closeIdentityEditor,
      saveIdentity,
      closeKeyEditor,
      saveKey,
    },
  } = useApp();
  return (
    <>
      {hostForm && !identityForm && !keyForm && !groupForm && (
        <HostEditor
          value={hostForm}
          onChange={setHostForm}
          view={view}
          busy={busy}
          error={hostAutosave.error || error}
          saveStatus={hostAutosave.status}
          hasUnsavedChanges={hostAutosave.dirty}
          onRetrySave={() => void hostAutosave.flush().catch(() => {})}
          onRevealPassword={() =>
            invokeScoped<string>("reveal_host_password", { id: hostForm.id })
          }
          onClose={closeHostEditor}
          onNewGroup={newFolderFromHost}
          onNewIdentity={newIdentityForm}
          onSubmit={submitHostEditor}
        />
      )}
      {groupForm && (
        <GroupEditor
          value={groupForm}
          onChange={setGroupForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={groupForm.returnTo}
          onClose={closeGroupEditor}
          onSubmit={saveGroup}
        />
      )}
      {identityForm && !keyForm && (
        <IdentityEditor
          value={identityForm}
          onChange={setIdentityForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={hostForm ? "host" : undefined}
          onClose={closeIdentityEditor}
          onNewKey={newKeyForm}
          onSubmit={saveIdentity}
        />
      )}
      {keyForm && (
        <KeyEditor
          value={keyForm}
          onChange={setKeyForm}
          view={view}
          busy={busy}
          error={error}
          returnTo={identityForm ? "identità" : undefined}
          onClose={closeKeyEditor}
          onSubmit={saveKey}
        />
      )}
    </>
  );
}
