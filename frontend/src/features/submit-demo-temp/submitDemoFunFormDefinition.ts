/**
 * TEMP(submit-demo): Form.io POST /form payload for the “Generate demo SOBA form” button.
 * Remove with `submit-demo-temp` when product form authoring replaces this path.
 */
export const SUBMIT_DEMO_FUN_FORM_DEFINITION: Record<string, unknown> = {
  display: 'form',
  type: 'form',
  title: 'Fun',
  name: 'fun',
  path: 'fun',
  tags: ['soba'],
  components: [
    {
      type: 'textfield',
      key: 'name',
      label: 'Name',
      input: true,
      tableView: true,
    },
    {
      type: 'checkbox',
      key: 'areWeHavingFunYet',
      label: 'Are we having fun yet?',
      input: true,
      tableView: false,
    },
    {
      type: 'button',
      action: 'submit',
      label: 'Submit',
      key: 'submit',
      disableOnInvalid: true,
      input: true,
      tableView: false,
    },
  ],
};
