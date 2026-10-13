import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { filterCafes, hasCoordinates } = createRequire(import.meta.url)('../app.js');
const { cafes } = JSON.parse(readFileSync(new URL('../data/cafes.json', import.meta.url)));
const statuses = ['确认还开', '大概率还开', '不确定', '大概率已关'];

test('默认隐藏可能已关店：35 个标记、14 家未定位', () => {
  const visible = filterCafes(cafes);
  assert.equal(visible.filter(hasCoordinates).length, 35);
  assert.equal(visible.filter(c => !hasCoordinates(c)).length, 14);
  assert.ok(visible.every(c => c.status !== '大概率已关'));
});
test('选中所有状态新增两家已关店', () => {
  assert.equal(filterCafes(cafes, { statuses }).filter(hasCoordinates).length, 37);
});
test('区与状态内部多选取并集，跨筛选与批次取交集', () => {
  const result = filterCafes(cafes, {
    districts: ['南山', '福田'], statuses: ['确认还开', '大概率还开'], batch: 'GitHub核对'
  });
  assert.deepEqual(result.map(c => c.name), ['COFFEE V·P·N 咖啡微品', '好运到咖啡士多', '集福咖啡', 'PRE 咖啡', '安文咖啡']);
});
test('清空区或状态选择应显示零家；空批次表示所有批次', () => {
  assert.equal(filterCafes(cafes, { districts: [] }).length, 0);
  assert.equal(filterCafes(cafes, { statuses: [] }).length, 0);
  assert.equal(filterCafes(cafes, { batch: '' }).length, 49);
  assert.equal(filterCafes(cafes, { batch: '不存在' }).length, 0);
});
test('未定位记录保留供侧栏使用，筛选不修改输入', () => {
  const snapshot = JSON.stringify(cafes);
  assert.equal(filterCafes(cafes, { districts: ['宝安'], batch: '小众' }).length, 4);
  assert.equal(JSON.stringify(cafes), snapshot);
});
test('坐标必须都是有效数字，不能将 null 或字符串当作坐标', () => {
  assert.equal(hasCoordinates({ lat: null, lng: 113.9 }), false);
  assert.equal(hasCoordinates({ lat: 22.5, lng: null }), false);
  assert.equal(hasCoordinates({ lat: '22.5', lng: 113.9 }), false);
  assert.equal(hasCoordinates({ lat: NaN, lng: 113.9 }), false);
  assert.equal(hasCoordinates({ lat: 91, lng: 113.9 }), false);
  assert.equal(hasCoordinates({ lat: 0, lng: 0 }), true);
});
