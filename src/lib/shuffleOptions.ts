import { Question } from '@/types';

/**
 * 打乱题目选项顺序
 * 确保正确答案不会总是在 A 选项
 */
export function shuffleOptions(question: Question): Question {
  // 创建选项数组，保留原始索引
  const optionsWithIndex = question.options.map((option, index) => ({
    text: option,
    originalIndex: index
  }));

  // Fisher-Yates 洗牌算法
  for (let i = optionsWithIndex.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
  }

  // 获取原始正确答案的索引（A=0, B=1, C=2, D=3）
  const originalAnswerIndex = question.answer.charCodeAt(0) - 65;
  
  // 找到正确答案在新数组中的位置
  const newAnswerIndex = optionsWithIndex.findIndex(item => item.originalIndex === originalAnswerIndex);
  
  // 生成新的选项文本（加上新的字母前缀）
  const newOptions = optionsWithIndex.map((item, index) => {
    const letter = String.fromCharCode(65 + index);
    // 移除原有的字母前缀（如 "A. "），然后加上新的
    const textWithoutPrefix = item.text.replace(/^[A-D]\.\s*/, '');
    return `${letter}. ${textWithoutPrefix}`;
  });

  // 生成新的正确答案字母
  const newAnswer = String.fromCharCode(65 + newAnswerIndex);

  return {
    ...question,
    options: newOptions,
    answer: newAnswer
  };
}

/**
 * 批量打乱题目选项
 */
export function shuffleAllQuestions(questions: Question[]): Question[] {
  return questions.map(question => shuffleOptions(question));
}
