import * as React from 'react';

/** FE03 1048/1109: values typed while a save was pending were not sent; they stay in the form, unsaved. */
export default function CmsTemplateLateEditNotice(): React.ReactElement {
  return (
    <p role="status" className="cms-template-late-edit">
      You changed this form while this was saving. Those changes were not sent
      and are not part of the saved draft; they stay here until you discard
      them.
    </p>
  );
}
