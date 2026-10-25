import { listPage, uuidPrefix } from './workspace.service.js';
import { ListQuery } from './workspace.dto.js';
describe('Workspace pagination and order references', () => {
  it('keeps totals when an older page is empty', () => {
    expect(listPage([], 121, { ...new ListQuery(), page: 8 })).toMatchObject({
      page: 8,
      pages: 7,
      total: 121,
      items: [],
    });
  });
  it('searches displayed short UUID references without reading all rows', () => {
    expect(uuidPrefix('#FD72A1B7')).toEqual({
      gte: 'fd72a1b7-0000-0000-0000-000000000000',
      lte: 'fd72a1b7-ffff-ffff-ffff-ffffffffffff',
    });
  });
  it('does not interpret names or SQL text as UUID ranges', () => {
    expect(uuidPrefix('Nimal')).toBeUndefined();
    expect(uuidPrefix('drop table;')).toBeUndefined();
  });
});
