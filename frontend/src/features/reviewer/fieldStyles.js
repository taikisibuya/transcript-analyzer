/** สไตล์ช่องกรอกตามสถานะเตือน (active | warn | critical | resolved) */
export const FIELD_STATE_CLASS = {
  active: 'border-warning bg-warning-bg ring-[3px] ring-warning/25',
  warn: 'border-warning bg-warning-bg',
  critical: 'border-danger bg-danger-soft/40',
  resolved: 'border-success-line',
}

export const CELL_STATE_CLASS = {
  active: '!border-warning !bg-warning-soft',
  warn: '!border-warning !bg-warning-soft',
  critical: '!border-danger !bg-danger-soft',
  resolved: '',
}
