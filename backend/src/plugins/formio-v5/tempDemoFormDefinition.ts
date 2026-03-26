/**
 * TEMP(submit-demo): Default Form.io form JSON when the outbox payload has no `formioFormDefinition`.
 * Remove when product form builder / persisted schema replaces this bootstrap path.
 */

export function getTempDemoFormDefinition(): Record<string, unknown> {
  return {
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
}
