import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSymptomTurn, buildSymptomContext, isNewSymptomTopicRequest } from '../src/utils/symptomConversation.mjs';

test('giữ mô tả chính và câu trả lời qua nhiều lượt', () => {
  let conversation = appendSymptomTurn(null, 'Con tôi bị sốt');
  conversation.pendingQuestions = ['Trẻ năm nay bao nhiêu tuổi?'];
  conversation = appendSymptomTurn(conversation, 'Trẻ năm nay 11 tuổi');
  conversation.pendingQuestions = ['Triệu chứng xuất hiện từ khi nào?'];
  conversation = appendSymptomTurn(conversation, 'Triệu chứng xuất hiện trong 3 tiếng rồi');

  const context = buildSymptomContext(conversation);
  assert.match(context, /Mô tả ban đầu: Con tôi bị sốt/);
  assert.match(context, /Câu hỏi làm rõ trước đó 1: Trẻ năm nay bao nhiêu tuổi\?/);
  assert.match(context, /Thông tin người dùng bổ sung 1: Trẻ năm nay 11 tuổi/);
  assert.match(context, /Câu hỏi làm rõ trước đó 2: Triệu chứng xuất hiện từ khi nào\?/);
  assert.match(context, /Thông tin người dùng bổ sung 2: Triệu chứng xuất hiện trong 3 tiếng rồi/);
});

test('thông tin triệu chứng đi kèm không bị hiểu nhầm là chủ đề mới', () => {
  assert.equal(isNewSymptomTopicRequest('Trẻ không có triệu chứng khác'), false);
  assert.equal(isNewSymptomTopicRequest('Tôi muốn bắt đầu vấn đề mới'), true);
});

test('ngữ cảnh gửi API luôn nằm trong giới hạn đầu vào Backend', () => {
  let conversation = appendSymptomTurn(null, 'A'.repeat(1500));
  for (let index = 0; index < 8; index += 1) {
    conversation.pendingQuestions = [`Question ${index}`];
    conversation = appendSymptomTurn(conversation, `B${index}`.repeat(300));
  }
  assert.ok(buildSymptomContext(conversation).length <= 2000);
});
