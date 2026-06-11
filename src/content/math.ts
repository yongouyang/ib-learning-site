import { Topic, Subject } from './types';
import mathDpDescriptiveStatistics from './math-phase3-math-dp-descriptive-statistics';
import mathDpComplexNumbers from './math-phase3-math-dp-complex-numbers';
import mathDpMatrices from './math-phase3-math-dp-matrices';
import mathDpCorrelationRegression from './math-phase3-math-dp-correlation-regression';
import mathDpPoissonDistribution from './math-phase3-math-dp-poisson';
import mathDpHypothesisTesting from './math-phase3-math-dp-hypothesis-testing';

import mathDPSequences from './math-phase3-math-dp-sequences';
import mathDPExponents from './math-phase3-math-dp-exponents';
import mathDPBinomial from './math-phase3-math-dp-binomial';
import mathDPFunctions from './math-phase3-math-dp-functions';
import mathDPQuadratics from './math-phase3-math-dp-quadratics';
import mathDPExpLog from './math-phase3-math-dp-explog';
import mathDPTrig from './math-phase3-math-dp-trig';
import mathDPVectors from './math-phase3-math-dp-vectors';
import mathDPDifferentiation from './math-phase3-math-dp-differentiation';
import mathDPIntegration from './math-phase3-math-dp-integration';
import mathDPProbability from './math-phase3-math-dp-probability';
import mathDPKinematics from './math-phase3-math-dp-kinematics';

// MARK: - Year 7 Topics (MYP 1–2, ages 11–12)

const yr7WrittenCalculations: Topic = {
  id: 'math-yr7-calculations',
  subjectId: 'math',
  title: 'Written Calculations',
  description: 'Using column methods for addition, subtraction, multiplication and division, and understanding the order of operations (BIDMAS).',
  ibLevel: 'MYP',
  notes: [
    { id: 'calc-n1', heading: 'Column Addition and Subtraction', body: 'When adding or subtracting large numbers, write them in columns with digits lined up by place value (ones under ones, tens under tens). Always start from the rightmost column. In addition, if a column sums to 10 or more, carry the extra digit to the next column. Example: 478 + 296 = 774 (8+6=14 carry 1; 7+9+1=17 carry 1; 4+2+1=7). In subtraction, if a digit is too small, borrow from the next column.' },
    { id: 'calc-n2', heading: 'Short and Long Multiplication', body: 'Short multiplication: multiply a number by a single digit, carrying extras. Example: 347 × 6 = 2082. Long multiplication: for multiplying by two or more digits, write each partial product on a new row shifted left, then add them. Example: 34 × 27 = 34×7 + 34×20 = 238 + 680 = 918.' },
    { id: 'calc-n3', heading: 'Short and Long Division', body: 'Short division (bus stop): divide by a single digit working left to right, carrying remainders. Example: 756 ÷ 3 = 252. Long division: for dividing by multi-digit numbers, use divide-multiply-subtract-bring down. Example: 672 ÷ 16 = 42.' },
    { id: 'calc-n4', heading: 'Order of Operations — BIDMAS', body: 'BIDMAS: Brackets first, Indices (powers), Division & Multiplication (left to right), Addition & Subtraction (left to right). Example: 3 + 4 × 5 = 3 + 20 = 23, NOT 7 × 5 = 35. With brackets: (3 + 4) × 5 = 35.' },
  ],
  flashcards: [
    { id: 'calc-f1', term: 'Place value', definition: 'The value of a digit based on its position — ones, tens, hundreds, etc.', example: 'In 3 462, the 4 means 4 hundreds (400).' },
    { id: 'calc-f2', term: 'Carrying', definition: 'When a column adds to 10+, write the ones digit and carry the tens to the next column.', example: '58 + 27: 8+7=15, write 5, carry 1.' },
    { id: 'calc-f3', term: 'Borrowing', definition: 'When a digit is too small, borrow 1 from the next left column (reduce it by 1) and add 10 to current digit.', example: '42 − 18: borrow from tens, 12−8=4.' },
    { id: 'calc-f4', term: 'Long multiplication', definition: 'Multiply by each digit of bottom number separately, write results shifted left, then add.', example: '45 × 23 = 45×3 + 45×20 = 135 + 900 = 1035.' },
    { id: 'calc-f5', term: 'Short division', definition: 'Division by a single digit: work left to right, carrying remainders.', example: '963 ÷ 3 = 321.' },
    { id: 'calc-f6', term: 'BIDMAS', definition: 'Order of operations: Brackets, Indices, Division & Multiplication (L→R), Addition & Subtraction (L→R).', example: '2 + 3 × 4 = 2 + 12 = 14.' },
    { id: 'calc-f7', term: 'Remainder', definition: 'Amount left after division when numbers don\'t divide exactly.', example: '17 ÷ 5 = 3 remainder 2.' },
    { id: 'calc-f8', term: 'Product', definition: 'The result of multiplying two or more numbers.', example: 'The product of 7 and 8 is 56.' },
  ],
  questions: [
    { id: 'calc-q1', stem: 'What is 5 236 + 3 748?', choices: ['8 984', '8 874', '8 974', '8 884'], correctIndex: 0, explanation: 'Add column by column: 6+8=14 (write 4 carry 1), 3+4+1=8, 2+7=9, 5+3=8. Answer: 8 984.' },
    { id: 'calc-q2', stem: 'What is 6 205 − 2 478?', choices: ['3 727', '4 727', '3 827', '3 737'], correctIndex: 0, explanation: 'Subtract with borrowing: 5−8 → 15−8=7; 9−7=2; 11−4=7; 5−2=3. Answer: 3 727.' },
    { id: 'calc-q3', stem: 'Multiply 64 by 7.', choices: ['428', '448', '468', '488'], correctIndex: 1, explanation: '64 × 7 = (60 × 7) + (4 × 7) = 420 + 28 = 448.' },
    { id: 'calc-q4', stem: 'What is 34 × 26?', choices: ['884', '864', '904', '844'], correctIndex: 0, explanation: '34×6=204, 34×20=680. Add: 204+680=884.' },
    { id: 'calc-q5', stem: 'Divide 875 by 5.', choices: ['165', '175', '155', '185'], correctIndex: 1, explanation: '875÷5: 8÷5=1 r3, 37÷5=7 r2, 25÷5=5. Answer: 175.' },
    { id: 'calc-q6', stem: 'What is 672 ÷ 16?', choices: ['42', '44', '38', '48'], correctIndex: 0, explanation: '16×42=672, so 672÷16=42.' },
    { id: 'calc-q7', stem: 'Using BIDMAS, what is 5 + 3 × 6?', choices: ['48', '23', '33', '28'], correctIndex: 1, explanation: 'Multiplication before addition: 3×6=18, then 5+18=23.' },
    { id: 'calc-q8', stem: 'What is (8 + 4) × 3 − 5?', choices: ['31', '25', '27', '41'], correctIndex: 0, explanation: 'Brackets: 8+4=12. Multiply: 12×3=36. Subtract: 36−5=31.' },
    { id: 'calc-q9', stem: 'Calculate 24 ÷ 6 + 3 × 2.', choices: ['7', '10', '14', '8'], correctIndex: 1, explanation: 'Division and multiplication first (L→R): 24÷6=4, 3×2=6. Add: 4+6=10.' },
    { id: 'calc-q10', stem: 'A school orders 15 boxes of pencils. Each box has 24 pencils. How many pencils total?', choices: ['360', '340', '380', '320'], correctIndex: 0, explanation: '15 × 24 = (15×20) + (15×4) = 300 + 60 = 360.' },
  ],
};

const yr7Decimals: Topic = {
  id: 'math-yr7-decimals',
  subjectId: 'math',
  title: 'Decimals',
  description: 'Understanding decimal place value, comparing and ordering, adding and subtracting decimals, and converting between fractions, decimals and percentages.',
  ibLevel: 'MYP',
  notes: [
    { id: 'dec-n1', heading: 'Decimal Place Value', body: 'Decimals extend place value to the right of the ones column: tenths (1/10), hundredths (1/100), thousandths (1/1000). In 3.47, 3 is ones, 4 is tenths (4/10), 7 is hundredths (7/100). Trailing zeros don\'t change a decimal\'s value: 0.6 = 0.60 = 0.600.' },
    { id: 'dec-n2', heading: 'Comparing and Ordering Decimals', body: 'Line up decimal points and compare digits left to right. Add trailing zeros to equalise decimal places. Example: compare 0.6, 0.58, 0.605 → write as 0.600, 0.580, 0.605 → order: 0.58, 0.6, 0.605.' },
    { id: 'dec-n3', heading: 'Adding, Subtracting and Multiplying Decimals', body: 'For addition/subtraction: align decimal points and fill gaps with zeros. Example: 4.7 + 2.35 = 4.70 + 2.35 = 7.05. Multiply by 10/100/1000 by moving the decimal point right. Divide by moving it left. For multiplying two decimals: multiply as whole numbers, then count total decimal places in both factors.' },
    { id: 'dec-n4', heading: 'Converting Between Fractions, Decimals and Percentages', body: 'Fraction → decimal: divide numerator by denominator (3/4 = 0.75). Decimal → percentage: × 100 (0.75×100=75%). Percentage → decimal: ÷ 100 (35%=0.35). Memorise: 1/2=0.5=50%, 1/4=0.25=25%, 3/4=0.75=75%, 1/5=0.2=20%, 1/10=0.1=10%.' },
  ],
  flashcards: [
    { id: 'dec-f1', term: 'Tenths', definition: 'First decimal place — one part out of ten (1/10 = 0.1).', example: 'In 2.7, the 7 is in the tenths place.' },
    { id: 'dec-f2', term: 'Hundredths', definition: 'Second decimal place — one part out of one hundred (1/100 = 0.01).', example: 'In 5.43, the 3 is in the hundredths place.' },
    { id: 'dec-f3', term: 'Decimal point', definition: 'The dot separating whole numbers from the fractional part.', example: 'In 14.28, the point separates 14 from 28 hundredths.' },
    { id: 'dec-f4', term: 'Comparing decimals', definition: 'Line up decimal points, compare digits left to right.', example: '0.7 > 0.69 because 0.70 > 0.69.' },
    { id: 'dec-f5', term: '× 10, × 100, × 1000', definition: 'Move decimal point 1, 2, or 3 places right.', example: '3.47 × 10 = 34.7; 3.47 × 100 = 347.' },
    { id: 'dec-f6', term: 'Fraction → decimal', definition: 'Divide numerator by denominator.', example: '7/8 = 7 ÷ 8 = 0.875.' },
    { id: 'dec-f7', term: 'Decimal → percentage', definition: 'Multiply by 100 and add %.', example: '0.42 × 100 = 42%.' },
    { id: 'dec-f8', term: 'Percentage → decimal', definition: 'Divide by 100.', example: '75% = 75 ÷ 100 = 0.75.' },
  ],
  questions: [
    { id: 'dec-q1', stem: 'In 5.38, what is the value of the digit 8?', choices: ['8 ones', '8 tenths', '8 hundredths', '8 thousandths'], correctIndex: 2, explanation: 'After the decimal: first digit = tenths (3), second = hundredths (8).' },
    { id: 'dec-q2', stem: 'Which is larger: 0.7 or 0.69?', choices: ['0.7', '0.69', 'Equal', 'Cannot tell'], correctIndex: 0, explanation: '0.70 > 0.69, so 0.7 is larger.' },
    { id: 'dec-q3', stem: 'Order smallest to largest: 0.45, 0.5, 0.09, 0.405.', choices: ['0.09, 0.405, 0.45, 0.5', '0.09, 0.45, 0.405, 0.5', '0.405, 0.45, 0.5, 0.09', '0.09, 0.45, 0.5, 0.405'], correctIndex: 0, explanation: 'As 0.090, 0.405, 0.450, 0.500 → 0.09, 0.405, 0.45, 0.5.' },
    { id: 'dec-q4', stem: 'What is 3.75 + 1.8?', choices: ['4.55', '5.55', '5.45', '4.65'], correctIndex: 1, explanation: '3.75 + 1.80 = 5.55.' },
    { id: 'dec-q5', stem: 'What is 5.2 − 3.87?', choices: ['1.33', '2.33', '1.43', '1.67'], correctIndex: 0, explanation: '5.20 − 3.87 = 1.33.' },
    { id: 'dec-q6', stem: 'What is 2.6 × 10?', choices: ['2.6', '26', '260', '0.26'], correctIndex: 1, explanation: 'Move decimal point one place right: 2.6 → 26.' },
    { id: 'dec-q7', stem: 'What is 47.3 ÷ 100?', choices: ['4.73', '473', '0.473', '4730'], correctIndex: 2, explanation: 'Move decimal point two places left: 47.3 → 0.473.' },
    { id: 'dec-q8', stem: 'Convert 3/5 to a decimal.', choices: ['0.35', '0.53', '0.6', '0.8'], correctIndex: 2, explanation: '3 ÷ 5 = 0.6, or 3/5 = 6/10 = 0.6.' },
    { id: 'dec-q9', stem: 'Convert 0.85 to a percentage.', choices: ['8.5%', '85%', '0.85%', '850%'], correctIndex: 1, explanation: '0.85 × 100 = 85%.' },
    { id: 'dec-q10', stem: 'Emma buys a notebook for £2.45 and a pen for £1.30. She pays with £5. How much change?', choices: ['£1.35', '£1.25', '£1.15', '£2.25'], correctIndex: 1, explanation: 'Total: £2.45 + £1.30 = £3.75. Change: £5 − £3.75 = £1.25.' },
  ],
};

const yr7Substitution: Topic = {
  id: 'math-yr7-substitution',
  subjectId: 'math',
  title: 'Algebra: Substitution',
  description: 'Writing algebraic expressions from words, substituting numbers for letters, and using simple formulas.',
  ibLevel: 'MYP',
  notes: [
    { id: 'sub-n1', heading: 'Writing Expressions from Words', body: 'Letters (variables) stand for unknown numbers. Translate: "more than" → +, "less than" → −, "times/of" → ×, "shared between" → ÷. For multiplication, write number first without ×: "5 times n" = 5n. "A number plus 7" = n+7. "Twice a number minus 3" = 2n−3.' },
    { id: 'sub-n2', heading: 'Substituting Values', body: 'Replace the letter with the given number and evaluate using BIDMAS. Example: If a=3, 4a+5 = 4×3+5 = 17. Watch exponents: 3x² means 3×(x²), not (3x)². If x=5, 3x² = 3×25 = 75.' },
    { id: 'sub-n3', heading: 'Using Simple Formulas', body: 'A formula is a rule connecting quantities. e.g., perimeter P=2(l+w). If l=8cm, w=5cm: P=2(8+5)=26cm. Common formulas: perimeter P=2l+2w, area A=lw, cost C=np. Write formula first, substitute, then calculate step by step.' },
    { id: 'sub-n4', heading: 'Expanding Brackets', body: 'Multiply the term outside by EVERY term inside: a(b+c) = ab+ac. Example: 3(x+4)=3x+12. 5(2y−3)=10y−15. Negative outside: −2(x−5)=−2x+10. Always expand before adding/subtracting other terms.' },
  ],
  flashcards: [
    { id: 'sub-f1', term: 'Variable', definition: 'A letter representing an unknown or changing number.', example: 'In 3x+2, x is the variable.' },
    { id: 'sub-f2', term: 'Expression', definition: 'Numbers, variables, and operations WITHOUT an equals sign.', example: '4n+7 (not an equation).' },
    { id: 'sub-f3', term: 'Substitution', definition: 'Replacing a variable with a number to evaluate an expression.', example: 'If a=6, 2a+3 = 2×6+3 = 15.' },
    { id: 'sub-f4', term: 'Formula', definition: 'A rule written with variables connecting quantities.', example: 'Area = l × w.' },
    { id: 'sub-f5', term: 'Coefficient', definition: 'The number multiplying a variable.', example: 'In 7x, 7 is the coefficient.' },
    { id: 'sub-f6', term: 'Like terms', definition: 'Terms with identical variable(s) to the same power(s).', example: '3x and 5x are like; 3x and 3x² are not.' },
    { id: 'sub-f7', term: 'Expanding brackets', definition: 'a(b+c) = ab+ac.', example: '4(2x+5) = 8x+20.' },
    { id: 'sub-f8', term: 'Evaluate', definition: 'Work out the numerical value by substituting and calculating.', example: 'Evaluate 3y−4 when y=5: 3×5−4 = 11.' },
  ],
  questions: [
    { id: 'sub-q1', stem: '"Five more than a number n" — write the expression.', choices: ['5n', 'n+5', 'n−5', '5−n'], correctIndex: 1, explanation: '"More than" = addition: n+5.' },
    { id: 'sub-q2', stem: 'If x=4, what is 3x+7?', choices: ['14', '17', '19', '21'], correctIndex: 2, explanation: '3×4+7 = 12+7 = 19.' },
    { id: 'sub-q3', stem: 'If a=3 and b=5, what is 2a+4b?', choices: ['23', '26', '21', '30'], correctIndex: 1, explanation: '2×3+4×5 = 6+20 = 26.' },
    { id: 'sub-q4', stem: 'What is y²+3 when y=4?', choices: ['11', '16', '19', '64'], correctIndex: 2, explanation: '4²+3 = 16+3 = 19.' },
    { id: 'sub-q5', stem: 'Taxi: £3 plus £2 per mile. Expression for cost of m miles?', choices: ['3m+2', '2m+3', '5m', '3+2+m'], correctIndex: 1, explanation: '£2 per mile = 2m, plus fixed £3: 2m+3.' },
    { id: 'sub-q6', stem: 'Find perimeter using P=2l+2w when l=6cm, w=4cm.', choices: ['20 cm', '24 cm', '28 cm', '10 cm'], correctIndex: 0, explanation: 'P = 2×6 + 2×4 = 12+8 = 20 cm.' },
    { id: 'sub-q7', stem: 'Expand 5(x+3).', choices: ['5x+3', '5x+8', '5x+15', 'x+15'], correctIndex: 2, explanation: '5×x=5x, 5×3=15 → 5x+15.' },
    { id: 'sub-q8', stem: 'Expand 3(2p−7).', choices: ['6p−7', '6p−21', '5p−21', '6p−10'], correctIndex: 1, explanation: '3×2p=6p, 3×(−7)=−21 → 6p−21.' },
    { id: 'sub-q9', stem: 'If n=10, what is 2n²?', choices: ['200', '400', '40', '100'], correctIndex: 0, explanation: 'n²=10²=100, 2×100=200. Exponent only applies to n.' },
    { id: 'sub-q10', stem: 'Plumber: £40 call-out + £25/hour. Cost for 3 hours?', choices: ['£115', '£75', '£95', '£105'], correctIndex: 0, explanation: '25h+40 with h=3: 25×3+40 = 75+40 = £115.' },
  ],
};

const yr7SolvingEquations: Topic = {
  id: 'math-yr7-equations',
  subjectId: 'math',
  title: 'Solving Equations',
  description: 'Solving one-step and two-step linear equations using inverse operations and the balance method.',
  ibLevel: 'MYP',
  notes: [
    { id: 'eq-n1', heading: 'What is an Equation?', body: 'An equation has an equals sign and states two expressions are equal. Think of a balanced scale — left must equal right. The solution is the value that makes it true. x+3=10 has solution x=7. Equations differ from expressions: 2x+5 is an expression; 2x+5=13 is an equation.' },
    { id: 'eq-n2', heading: 'Solving One-Step Equations', body: 'Use the inverse operation to isolate the variable. Golden rule: whatever you do to one side, do EXACTLY the same to the other. Addition ↔ Subtraction, Multiplication ↔ Division. Examples: x+5=12 → x=7; y−3=8 → y=11; 4n=20 → n=5; m/3=7 → m=21. Always check by substituting back.' },
    { id: 'eq-n3', heading: 'Solving Two-Step Equations', body: 'Undo addition/subtraction first, then multiplication/division (SADMEP — reverse of PEMDAS). Example: 3x+4=19 → subtract 4: 3x=15 → divide by 3: x=5. Example: 2p−7=11 → add 7: 2p=18 → divide by 2: p=9.' },
    { id: 'eq-n4', heading: 'Forming Equations from Word Problems', body: 'Steps: (1) Identify the unknown, give it a letter. (2) Translate the situation into an equation. (3) Solve. (4) Answer in context with units. Example: "I think of a number, multiply by 4, add 7, get 35." Let n be the number: 4n+7=35 → 4n=28 → n=7.' },
  ],
  flashcards: [
    { id: 'eq-f1', term: 'Equation', definition: 'A mathematical sentence with an equals sign.', example: '2x+5=17.' },
    { id: 'eq-f2', term: 'Solution', definition: 'The value of the variable that makes the equation true.', example: 'x+4=10 → x=6.' },
    { id: 'eq-f3', term: 'Inverse operations', definition: 'Opposite operations: + ↔ −, × ↔ ÷.', example: 'To solve x+3=8: subtract 3.' },
    { id: 'eq-f4', term: 'Balance method', definition: 'Do the same operation to BOTH sides.', example: '3x=15 → divide both sides by 3.' },
    { id: 'eq-f5', term: 'Isolate the variable', definition: 'Get the variable alone on one side.', example: '2y−3=9 → add 3: 2y=12 → divide by 2: y=6.' },
    { id: 'eq-f6', term: 'One-step equation', definition: 'Solved with a single inverse operation.', example: 'x+5=13 → x=8.' },
    { id: 'eq-f7', term: 'Two-step equation', definition: 'Requires two inverse operations.', example: '4x−7=13 → add 7 → divide by 4 → x=5.' },
    { id: 'eq-f8', term: 'Checking', definition: 'Substitute solution back into original equation.', example: 'If x=4, 2(4)+1=9 ✓.' },
  ],
  questions: [
    { id: 'eq-q1', stem: 'Solve: x+9=15', choices: ['x=6', 'x=24', 'x=5', 'x=−6'], correctIndex: 0, explanation: 'Subtract 9: x=15−9=6.' },
    { id: 'eq-q2', stem: 'Solve: y−5=12', choices: ['y=7', 'y=17', 'y=−7', 'y=60'], correctIndex: 1, explanation: 'Add 5: y=12+5=17.' },
    { id: 'eq-q3', stem: 'Solve: 6n=42', choices: ['n=7', 'n=6', 'n=8', 'n=36'], correctIndex: 0, explanation: 'Divide by 6: n=42÷6=7.' },
    { id: 'eq-q4', stem: 'Solve: p/4=9', choices: ['p=2.25', 'p=13', 'p=36', 'p=5'], correctIndex: 2, explanation: 'Multiply by 4: p=9×4=36.' },
    { id: 'eq-q5', stem: 'Solve: 2x+3=17', choices: ['x=7', 'x=10', 'x=5', 'x=8.5'], correctIndex: 0, explanation: 'Subtract 3: 2x=14, divide by 2: x=7.' },
    { id: 'eq-q6', stem: 'Solve: 5y−8=22', choices: ['y=2.8', 'y=6', 'y=14', 'y=30'], correctIndex: 1, explanation: 'Add 8: 5y=30, divide by 5: y=6.' },
    { id: 'eq-q7', stem: 'Solve: x/3+2=7', choices: ['x=15', 'x=27', 'x=9', 'x=3'], correctIndex: 0, explanation: 'Subtract 2: x/3=5, multiply by 3: x=15.' },
    { id: 'eq-q8', stem: 'I think of a number, multiply by 3, subtract 4, get 20. Find the number.', choices: ['6', '8', '7', '5'], correctIndex: 1, explanation: '3n−4=20 → 3n=24 → n=8.' },
    { id: 'eq-q9', stem: 'Solve: 4(x−2)=20', choices: ['x=7', 'x=5.5', 'x=3', 'x=6'], correctIndex: 0, explanation: 'Expand: 4x−8=20 → 4x=28 → x=7.' },
    { id: 'eq-q10', stem: 'Perimeter of rectangle is 38cm, length 12cm. Find width. (P=2l+2w)', choices: ['7 cm', '8 cm', '13 cm', '6 cm'], correctIndex: 0, explanation: '38=2×12+2w → 38=24+2w → 14=2w → w=7cm.' },
  ],
};

const yr7Transformations: Topic = {
  id: 'math-yr7-transformations',
  subjectId: 'math',
  title: 'Transformations',
  description: 'Understanding reflection, rotation, translation, and enlargement of 2D shapes on a coordinate grid.',
  ibLevel: 'MYP',
  notes: [
    { id: 'trans-n1', heading: 'Reflection', body: 'A mirror image across a mirror line. Each point is the same perpendicular distance from the mirror line as its image. Common mirror lines: x-axis, y-axis, y=x, or vertical/horizontal lines like x=2. The shape stays the same size and shape (congruent).' },
    { id: 'trans-n2', heading: 'Rotation', body: 'Turns a shape around a fixed centre of rotation. Describe with: (1) centre point, (2) angle (90°, 180°, 270°), (3) direction (clockwise/anticlockwise). Use tracing paper to rotate on a grid. The shape is congruent to the original — only orientation changes.' },
    { id: 'trans-n3', heading: 'Translation', body: 'Slides a shape without turning, flipping, or resizing. Described by a column vector: top number = horizontal (positive=right), bottom number = vertical (positive=up). Vector (3,−2) means move 3 right and 2 down. Every point moves by the same vector.' },
    { id: 'trans-n4', heading: 'Enlargement', body: 'Changes shape size by a scale factor about a centre of enlargement. Scale factor > 1 = bigger; between 0 and 1 = smaller. At Year 7, centre is usually (0,0): multiply each coordinate by the scale factor. The enlarged shape is similar (same shape, different size), not congruent.' },
  ],
  flashcards: [
    { id: 'trans-f1', term: 'Reflection', definition: 'Mirror image across a line. Shape stays congruent.', example: 'Reflecting a triangle in the y-axis.' },
    { id: 'trans-f2', term: 'Mirror line', definition: 'The line across which reflection happens.', example: 'x-axis, y-axis, y=1, x=−2.' },
    { id: 'trans-f3', term: 'Rotation', definition: 'Turning a shape around a fixed point by an angle.', example: '90° clockwise around (0,0).' },
    { id: 'trans-f4', term: 'Centre of rotation', definition: 'Fixed point around which rotation happens.', example: 'Origin (0,0) or a shape vertex.' },
    { id: 'trans-f5', term: 'Translation', definition: 'Sliding a shape — every point moves same distance, same direction.', example: 'Vector (4,−2): 4 right, 2 down.' },
    { id: 'trans-f6', term: 'Translation vector', definition: 'Column showing horizontal (top) and vertical (bottom) movement.', example: '(3,5) = 3 right, 5 up.' },
    { id: 'trans-f7', term: 'Enlargement', definition: 'Changing size by multiplying distances from a centre by a scale factor.', example: 'Scale factor 2 doubles all sides.' },
    { id: 'trans-f8', term: 'Scale factor', definition: 'The multiplier in enlargement. >1 = bigger, 0–1 = smaller.', example: 'Scale factor 3: sides triple.' },
  ],
  questions: [
    { id: 'trans-q1', stem: 'Which transformation creates a mirror image?', choices: ['Rotation', 'Translation', 'Enlargement', 'Reflection'], correctIndex: 3, explanation: 'Reflection flips a shape across a mirror line.' },
    { id: 'trans-q2', stem: 'Point (3,4) reflected in x-axis. New coordinates?', choices: ['(3,−4)', '(−3,4)', '(−3,−4)', '(4,3)'], correctIndex: 0, explanation: 'Reflection in x-axis: (x,y)→(x,−y). So (3,4)→(3,−4).' },
    { id: 'trans-q3', stem: 'Point (2,−5) reflected in y-axis. New coordinates?', choices: ['(2,5)', '(−2,−5)', '(−2,5)', '(5,−2)'], correctIndex: 1, explanation: 'Reflection in y-axis: (x,y)→(−x,y). So (2,−5)→(−2,−5).' },
    { id: 'trans-q4', stem: 'Rotated 180° around (0,0). What happens to (3,2)?', choices: ['(3,2)', '(−3,2)', '(3,−2)', '(−3,−2)'], correctIndex: 3, explanation: '180° rotation: (x,y)→(−x,−y). So (3,2)→(−3,−2).' },
    { id: 'trans-q5', stem: 'Vector (4,−3) means:', choices: ['4 right, 3 down', '4 left, 3 up', '4 right, 3 up', '4 left, 3 down'], correctIndex: 0, explanation: '+4 = right, −3 = down.' },
    { id: 'trans-q6', stem: 'Point (1,5) after translation (−2,3). New position?', choices: ['(3,8)', '(−1,8)', '(−1,2)', '(3,2)'], correctIndex: 1, explanation: '1+(−2)=−1, 5+3=8. New point: (−1,8).' },
    { id: 'trans-q7', stem: 'Square vertices (1,1),(3,1),(3,3),(1,3) enlarged by scale factor 2 around (0,0). New vertices?', choices: ['(2,2),(6,2),(6,6),(2,6)', '(2,2),(4,2),(4,4),(2,4)', '(3,3),(5,3),(5,5),(3,5)', '(1,1),(6,1),(6,6),(1,6)'], correctIndex: 0, explanation: 'Multiply each coordinate by 2.' },
    { id: 'trans-q8', stem: 'Scale factor 1 enlargement does what?', choices: ['Gets bigger', 'Gets smaller', 'Stays same', 'Disappears'], correctIndex: 2, explanation: 'Multiplying by 1 changes nothing.' },
    { id: 'trans-q9', stem: 'Which transformation changes shape SIZE?', choices: ['Reflection', 'Translation', 'Rotation', 'Enlargement'], correctIndex: 3, explanation: 'Only enlargement changes size. Others are congruent.' },
    { id: 'trans-q10', stem: 'Reflect (5,2) in x=1. New coordinates?', choices: ['(−3,2)', '(−5,2)', '(1,2)', '(6,2)'], correctIndex: 0, explanation: 'Distance from x=5 to x=1 is 4. Go 4 units other side: 1−4=−3. y stays 2.' },
  ],
};

const yr7Probability: Topic = {
  id: 'math-yr7-probability',
  subjectId: 'math',
  title: 'Probability',
  description: 'The probability scale, calculating simple probabilities, sample spaces, and experimental vs theoretical probability.',
  ibLevel: 'MYP',
  notes: [
    { id: 'prob-n1', heading: 'The Probability Scale', body: 'Probability is a number between 0 (impossible) and 1 (certain). 0.5 = equally likely as not. Can be written as fraction, decimal, or percentage: 1/4 = 0.25 = 25%. The probability scale: 0 = impossible, 1 = certain, everything in between measures likelihood.' },
    { id: 'prob-n2', heading: 'Calculating Probability', body: 'P(event) = favourable outcomes ÷ total outcomes. Example: bag with 3 red, 5 blue, 2 green marbles: P(red)=3/10=0.3. All probabilities sum to 1. P(not event) = 1 − P(event). All probabilities must be between 0 and 1.' },
    { id: 'prob-n3', heading: 'Sample Spaces', body: 'The set of ALL possible outcomes. For a die: {1,2,3,4,5,6}. For two coins: {HH, HT, TH, TT} — 4 equally likely outcomes with P=1/4 each. Use a table for two dice (36 outcomes). Always check: do all outcomes sum to the total? Are they equally likely?' },
    { id: 'prob-n4', heading: 'Experimental vs Theoretical', body: 'Theoretical = what SHOULD happen (favourable ÷ total). Experimental (relative frequency) = what ACTUALLY happens (occurrences ÷ trials). Example: 100 coin flips, 47 heads → experimental P=0.47, theoretical P=0.5. More trials → experimental gets closer to theoretical (law of large numbers).' },
  ],
  flashcards: [
    { id: 'prob-f1', term: 'Probability', definition: 'A number 0–1 describing how likely an event is.', example: 'P(rolling a 4 on a die) = 1/6.' },
    { id: 'prob-f2', term: 'Impossible', definition: 'Cannot happen; probability = 0.', example: 'Rolling a 12 on a normal die.' },
    { id: 'prob-f3', term: 'Certain', definition: 'Will definitely happen; probability = 1.', example: 'The sun rising tomorrow.' },
    { id: 'prob-f4', term: 'Even chance', definition: 'Equally likely to happen or not; P=0.5.', example: 'Heads on a fair coin flip.' },
    { id: 'prob-f5', term: 'Sample space', definition: 'ALL possible outcomes of an experiment.', example: 'For a die: {1,2,3,4,5,6}.' },
    { id: 'prob-f6', term: 'Theoretical probability', definition: 'P(event) = favourable ÷ total, assuming equally likely outcomes.', example: 'P(even on die) = 3/6 = 1/2.' },
    { id: 'prob-f7', term: 'Experimental probability', definition: 'Based on actual trials: successes ÷ total trials.', example: '28 heads in 50 flips → P=28/50=0.56.' },
    { id: 'prob-f8', term: 'Mutually exclusive', definition: 'Events that cannot happen at the same time.', example: 'Cannot roll a 2 AND 5 on one die roll.' },
  ],
  questions: [
    { id: 'prob-q1', stem: 'Which probability means CERTAIN?', choices: ['0', '0.5', '1', '0.9'], correctIndex: 2, explanation: 'Probability 1 means the event is certain.' },
    { id: 'prob-q2', stem: 'Die roll: P(factor of 6)? Factors of 6 are 1,2,3,6.', choices: ['1/6', '1/3', '1/2', '2/3'], correctIndex: 3, explanation: '4 favourable out of 6: P=4/6=2/3.' },
    { id: 'prob-q3', stem: 'Bag: 2 red, 3 blue, 5 green. P(blue)?', choices: ['3/10', '3/7', '1/3', '3/5'], correctIndex: 0, explanation: 'Total=10, blue=3. P=3/10.' },
    { id: 'prob-q4', stem: 'P(rain)=0.3. P(NOT rain)=?', choices: ['0.3', '0.6', '0.7', '1'], correctIndex: 2, explanation: 'P(not rain)=1−0.3=0.7.' },
    { id: 'prob-q5', stem: 'Two coins flipped. How many possible outcomes?', choices: ['2', '3', '4', '8'], correctIndex: 2, explanation: 'HH, HT, TH, TT — 4 outcomes.' },
    { id: 'prob-q6', stem: 'Two coins: P(at least one head)?', choices: ['1/4', '1/2', '3/4', '1'], correctIndex: 2, explanation: 'HH, HT, TH have at least one head: 3/4.' },
    { id: 'prob-q7', stem: 'Spinner: red, blue, green, yellow (equal). P(red or blue)?', choices: ['1/4', '1/2', '3/4', '1/3'], correctIndex: 1, explanation: 'P(red)+P(blue)=1/4+1/4=1/2.' },
    { id: 'prob-q8', stem: '60 die rolls, six came up 13 times. Experimental P(six)?', choices: ['1/6', '13/60', '6/60', '13/47'], correctIndex: 1, explanation: 'Experimental = successes÷trials = 13/60.' },
    { id: 'prob-q9', stem: 'Which CANNOT be a probability?', choices: ['0.5', '3/4', '1.2', '0%'], correctIndex: 2, explanation: '1.2 > 1, so cannot be a probability.' },
    { id: 'prob-q10', stem: 'Letter chosen from "PROBABILITY". P(choosing B)?', choices: ['2/11', '1/11', '3/11', '2/9'], correctIndex: 0, explanation: '11 letters total, B appears twice. P=2/11.' },
  ],
};

const yr7DataAndAverages: Topic = {
  id: 'math-yr7-data',
  subjectId: 'math',
  title: 'Data & Averages',
  description: 'Collecting, displaying and interpreting data using bar charts, pictograms and pie charts. Finding the mean, median, mode and range.',
  ibLevel: 'MYP',
  notes: [
    { id: 'data-n1', heading: 'Collecting and Organising Data', body: 'Data is collected through surveys, measurements, or experiments. Organise into frequency tables (value + count). Use tally marks (groups of 5: four lines + diagonal). For many values, group into class intervals (0−9, 10−19, etc.). Always label tables clearly.' },
    { id: 'data-n2', heading: 'Bar Charts, Pictograms and Pie Charts', body: 'Bar chart: bar height = frequency, equal bar widths, equal gaps, labelled axes. Pictogram: pictures represent values — always check the key (e.g., one star = 5 books). Pie chart: shows parts of a whole — each sector angle = (frequency ÷ total) × 360°.' },
    { id: 'data-n3', heading: 'Mean, Median, Mode and Range', body: 'Mean = sum ÷ count. Median = middle value when ordered (average two middle values if even count). Mode = most frequent value. Range = max − min. Example: 3,5,7,4,6 → mean=5, median=5, no single mode, range=4.' },
    { id: 'data-n4', heading: 'Choosing the Right Average', body: 'Mean: uses every value, affected by outliers. Median: better with outliers (e.g., 2,3,4,4,100 → mean=22.6, median=4). Mode: best for non-numerical data or most common answer. Always report an average + range for a complete picture.' },
  ],
  flashcards: [
    { id: 'data-f1', term: 'Mean', definition: 'Sum of all values ÷ number of values.', example: '4,6,8,10 → mean = 28÷4 = 7.' },
    { id: 'data-f2', term: 'Median', definition: 'Middle value when data is ordered.', example: '2,3,7,9,11 → median = 7.' },
    { id: 'data-f3', term: 'Mode', definition: 'The value that appears most often.', example: '3,3,5,7,7,7,9 → mode = 7.' },
    { id: 'data-f4', term: 'Range', definition: 'Maximum minus minimum.', example: '4,8,15,2,9 → range = 15−2 = 13.' },
    { id: 'data-f5', term: 'Frequency table', definition: 'Table showing values/categories with how often each occurs.', example: 'Tally of students\' favourite sports.' },
    { id: 'data-f6', term: 'Bar chart', definition: 'Rectangular bars where height = frequency. Equal widths and gaps.', example: 'Number of pets owned by classmates.' },
    { id: 'data-f7', term: 'Pictogram', definition: 'Pictures represent data values. Always check the key.', example: '★ = 5 books; 4★ = 20 books.' },
    { id: 'data-f8', term: 'Outlier', definition: 'A value far from most others — strongly affects mean, not median.', example: 'In 2,3,3,4,50: 50 is an outlier.' },
  ],
  questions: [
    { id: 'data-q1', stem: 'Find the mean of: 6,8,10,12,14.', choices: ['8', '9', '10', '12'], correctIndex: 2, explanation: 'Sum=50, count=5. 50÷5=10.' },
    { id: 'data-q2', stem: 'Find the median of: 3,9,1,7,5.', choices: ['3', '5', '7', '9'], correctIndex: 1, explanation: 'Order: 1,3,5,7,9. Middle = 5.' },
    { id: 'data-q3', stem: 'Find the mode of: 4,7,2,7,9,7,3.', choices: ['4', '7', '2', 'No mode'], correctIndex: 1, explanation: '7 appears three times — most frequent.' },
    { id: 'data-q4', stem: 'Find the range of: 12,5,19,8,3.', choices: ['8', '16', '14', '11'], correctIndex: 1, explanation: '19−3=16.' },
    { id: 'data-q5', stem: 'Heights: 120cm, 115cm, 130cm, 127cm. Mean height?', choices: ['123 cm', '125 cm', '120 cm', '122 cm'], correctIndex: 0, explanation: '120+115+130+127=492. 492÷4=123cm.' },
    { id: 'data-q6', stem: 'Median of: 22,18,30,26,20,24.', choices: ['22', '23', '24', '25'], correctIndex: 1, explanation: 'Order: 18,20,22,24,26,30. Middle two: (22+24)÷2=23.' },
    { id: 'data-q7', stem: 'Scores: 8,7,9,6,10. Next test score is 2. Which average is most affected?', choices: ['Mode', 'Median', 'Mean', 'Range'], correctIndex: 2, explanation: 'Mean drops significantly with the outlier of 2.' },
    { id: 'data-q8', stem: 'Data: dogs=8, cats=5, fish=3, rabbits=4. Best chart for proportions?', choices: ['Bar chart', 'Pictogram', 'Pie chart', 'Line graph'], correctIndex: 2, explanation: 'Pie chart best shows parts of a whole.' },
    { id: 'data-q9', stem: 'Survey of 30: 15 blue, 9 red, 6 green. Pie chart angle for blue?', choices: ['90°', '120°', '180°', '360°'], correctIndex: 2, explanation: '(15÷30)×360° = 0.5×360° = 180°.' },
    { id: 'data-q10', stem: 'Mean=8, median=6, mode=5. What\'s likely true?', choices: ['All values equal', 'Data is symmetric', 'High value(s) pulling mean up', 'Median is wrong'], correctIndex: 2, explanation: 'Mean > median suggests outliers pulling the mean higher.' },
  ],
};

const yr7MathTopics = [
  yr7WrittenCalculations,
  yr7Decimals,
  yr7Substitution,
  yr7SolvingEquations,
  yr7Transformations,
  yr7Probability,
  yr7DataAndAverages,
];

// Existing MYP topics (ported from iOS app)
const mathAlgebraBasics: Topic = {
  id: 'math-algebra-1',
  subjectId: 'math',
  title: 'Algebra Basics',
  description: 'Using letters to represent unknown values and solving equations.',
  ibLevel: 'MYP',
  notes: [
    { id: 'alg-n1', heading: 'Variables and Expressions', body: 'Letters (variables) represent unknown numbers. An algebraic expression combines numbers, variables, and operations — like 2x+3 or 5y−7. No equals sign. The number in front is the coefficient (in 4x, the coefficient is 4).' },
    { id: 'alg-n2', heading: 'Solving One-Step Equations', body: 'Use inverse operations to isolate the variable. Golden rule: whatever you do to one side, do to the other. If x+5=12, subtract 5: x=7. If 3x=18, divide by 3: x=6.' },
    { id: 'alg-n3', heading: 'Expanding and Simplifying', body: 'Expand brackets: multiply outside term by every inside term. 3(x+4)=3x+12. Simplify by collecting like terms: 5x+3+2x−1 = 7x+2. Cannot combine unlike terms like 3x and 3x².' },
  ],
  flashcards: [
    { id: 'alg-f1', term: 'Variable', definition: 'A letter representing an unknown or changing number.', example: 'In 2x+3, x is the variable.' },
    { id: 'alg-f2', term: 'Coefficient', definition: 'The number multiplied by a variable.', example: 'In 7y, the coefficient is 7.' },
    { id: 'alg-f3', term: 'Equation', definition: 'A statement showing two expressions are equal, with an equals sign.', example: '3x+2=11' },
    { id: 'alg-f4', term: 'Like terms', definition: 'Terms with the same variable to the same power.', example: '3x and 5x are like; 3x and 3x² are not.' },
    { id: 'alg-f5', term: 'Expanding brackets', definition: 'Multiply outside term by every inside term.', example: '4(x+3)=4x+12' },
  ],
  questions: [
    { id: 'alg-q1', stem: 'If 2x+6=14, what is x?', choices: ['3', '4', '7', '10'], correctIndex: 1, explanation: '2x=8, x=4.' },
    { id: 'alg-q2', stem: 'Simplify: 5a+3b−2a+b', choices: ['3a+4b', '7a+4b', '3a+2b', '7a+2b'], correctIndex: 0, explanation: '(5a−2a)+(3b+b)=3a+4b.' },
    { id: 'alg-q3', stem: 'Coefficient of y in 9y−4?', choices: ['−4', '4', '9', '−9'], correctIndex: 2, explanation: 'The coefficient of y is 9.' },
    { id: 'alg-q4', stem: 'Expand: 3(2x−5)', choices: ['6x−5', '6x−15', '5x−15', '6x+15'], correctIndex: 1, explanation: '3×2x=6x, 3×(−5)=−15 → 6x−15.' },
    { id: 'alg-q5', stem: 'Which is an expression (not an equation)?', choices: ['x+4=10', '2y=8', '3x−7', '5+n=12'], correctIndex: 2, explanation: '3x−7 has no equals sign — it is an expression.' },
  ],
};

const mathFractionsPercentages: Topic = {
  id: 'math-fractions-1',
  subjectId: 'math',
  title: 'Fractions & Percentages',
  description: 'Working with parts of a whole and converting between fractions, decimals, and percentages.',
  ibLevel: 'MYP',
  notes: [
    { id: 'frac-n1', heading: 'Equivalent Fractions and Simplifying', body: 'Equivalent fractions represent the same amount: 1/2=2/4=4/8. To simplify, divide numerator and denominator by their HCF. Example: 12/18 → HCF=6 → 2/3.' },
    { id: 'frac-n2', heading: 'Adding and Multiplying Fractions', body: 'To add/subtract: find common denominator (LCM). Multiply fractions: multiply numerators together, denominators together. (2/3)×(4/5)=8/15. Always simplify.' },
    { id: 'frac-n3', heading: 'Percentages and Conversions', body: 'Percent = "out of 100". Fraction → percentage: numerator÷denominator×100. 3/4=75%. Percentage of amount: convert to decimal and multiply. 20% of 60 = 0.20×60 = 12.' },
  ],
  flashcards: [
    { id: 'frac-f1', term: 'Numerator', definition: 'The top number — how many parts you have.', example: 'In 3/5, numerator is 3.' },
    { id: 'frac-f2', term: 'Denominator', definition: 'The bottom number — how many equal parts the whole is divided into.', example: 'In 3/5, denominator is 5.' },
    { id: 'frac-f3', term: 'Equivalent fractions', definition: 'Different numerators/denominators but same value.', example: '1/2=2/4=50/100' },
    { id: 'frac-f4', term: 'Percentage', definition: 'A fraction of 100, shown with %.', example: '45% = 45 out of 100.' },
    { id: 'frac-f5', term: 'Percentage increase', definition: '(increase ÷ original) × 100.', example: '£20→£25: (5÷20)×100=25%.' },
  ],
  questions: [
    { id: 'frac-q1', stem: '3/4 as a percentage?', choices: ['34%', '43%', '75%', '25%'], correctIndex: 2, explanation: '3÷4=0.75, ×100=75%.' },
    { id: 'frac-q2', stem: '1/3 + 1/6?', choices: ['2/9', '2/6', '1/2', '1/3'], correctIndex: 2, explanation: 'Common denominator 6: 2/6+1/6=3/6=1/2.' },
    { id: 'frac-q3', stem: '20% of 150?', choices: ['20', '25', '30', '35'], correctIndex: 2, explanation: '0.20×150=30.' },
    { id: 'frac-q4', stem: 'Simplify 18/24.', choices: ['9/12', '3/4', '6/8', '2/3'], correctIndex: 1, explanation: 'HCF=6: 18÷6=3, 24÷6=4 → 3/4.' },
    { id: 'frac-q5', stem: 'Jacket £80, 15% off. Sale price?', choices: ['£12', '£65', '£68', '£72'], correctIndex: 2, explanation: '15% of £80=£12. £80−£12=£68.' },
  ],
};

const mathGeometry: Topic = {
  id: 'math-geometry-1',
  subjectId: 'math',
  title: 'Geometry (Angles & Shapes)',
  description: 'Properties of angles, triangles, quadrilaterals, and circles.',
  ibLevel: 'MYP',
  notes: [
    { id: 'geo-n1', heading: 'Angle Rules', body: 'Angles on a straight line = 180°. Angles around a point = 360°. Vertically opposite angles are equal. Triangle interior angles = 180°. Quadrilateral interior angles = 360°.' },
    { id: 'geo-n2', heading: 'Triangles and Quadrilaterals', body: 'Triangles: equilateral (all sides equal, 60° each), isosceles (two equal sides), scalene (no equal sides). Square: 4 equal sides, 4 right angles. Rectangle: 4 right angles. Parallelogram: 2 pairs parallel sides. Rhombus: 4 equal sides. Trapezium: exactly 1 pair parallel sides.' },
    { id: 'geo-n3', heading: 'Perimeter and Area', body: 'Perimeter = distance around. Area formulas: rectangle = l×w, triangle = (b×h)÷2, circle = πr². Circumference = 2πr. Use consistent units: cm gives cm² for area.' },
  ],
  flashcards: [
    { id: 'geo-f1', term: 'Vertically opposite angles', definition: 'Angles across from each other when lines intersect — always equal.', example: undefined },
    { id: 'geo-f2', term: 'Equilateral triangle', definition: 'All sides equal, all angles 60°.', example: undefined },
    { id: 'geo-f3', term: 'Area of triangle', definition: 'Area = (base × height) ÷ 2', example: 'Base=8cm, h=5cm → 20cm²' },
    { id: 'geo-f4', term: 'Circumference', definition: 'C = πd or C = 2πr', example: 'r=7cm → C≈43.98cm' },
    { id: 'geo-f5', term: 'Parallelogram', definition: 'Quadrilateral with two pairs of parallel sides.', example: undefined },
  ],
  questions: [
    { id: 'geo-q1', stem: 'Two angles on a straight line: x and 55°. Find x.', choices: ['55°', '125°', '135°', '115°'], correctIndex: 1, explanation: '180°−55°=125°.' },
    { id: 'geo-q2', stem: 'Triangle: 90° and 35°. Third angle?', choices: ['45°', '65°', '55°', '70°'], correctIndex: 2, explanation: '180°−90°−35°=55°.' },
    { id: 'geo-q3', stem: 'Area of rectangle: l=12cm, w=5cm?', choices: ['34 cm²', '60 cm²', '17 cm²', '55 cm²'], correctIndex: 1, explanation: '12×5=60 cm².' },
    { id: 'geo-q4', stem: 'Which has exactly one pair of parallel sides?', choices: ['Parallelogram', 'Rectangle', 'Trapezium', 'Rhombus'], correctIndex: 2, explanation: 'Trapezium has exactly one pair.' },
    { id: 'geo-q5', stem: 'Triangle: base 10cm, height 6cm. Area?', choices: ['60 cm²', '16 cm²', '30 cm²', '20 cm²'], correctIndex: 2, explanation: '(10×6)÷2=30 cm².' },
  ],
};

const mathStatistics: Topic = {
  id: 'math-statistics-1',
  subjectId: 'math',
  title: 'Statistics & Data',
  description: 'Collecting, organising, and interpreting data using averages and graphs.',
  ibLevel: 'MYP',
  notes: [
    { id: 'stat-n1', heading: 'Mean, Median, Mode, Range', body: 'Mean: sum÷count. Median: middle value when ordered. Mode: most frequent. Range: max−min. Each measure tells a different story about the data.' },
    { id: 'stat-n2', heading: 'Reading and Drawing Graphs', body: 'Bar charts: bar height=frequency. Line graphs: show change over time. Pie charts: show parts of a whole (each sector = proportion of 360°). Always check title, axis labels, and scale.' },
    { id: 'stat-n3', heading: 'Probability', body: 'Probability scale: 0 (impossible) to 1 (certain). P(event) = favourable ÷ total. P(not A) = 1−P(A). All possible outcomes sum to 1.' },
  ],
  flashcards: [
    { id: 'stat-f1', term: 'Mean', definition: 'Sum of all values ÷ count.', example: '3,5,7,9,1 → (3+5+7+9+1)÷5=5' },
    { id: 'stat-f2', term: 'Median', definition: 'Middle value when ordered.', example: '2,4,7,9,11 → median=7' },
    { id: 'stat-f3', term: 'Mode', definition: 'Most frequent value.', example: '3,3,5,7,3,9 → mode=3' },
    { id: 'stat-f4', term: 'Range', definition: 'Max − min.', example: '4,9,2,15,6 → 15−2=13' },
    { id: 'stat-f5', term: 'Probability', definition: '0 to 1 measure of likelihood. P = favourable ÷ total.', example: 'P(heads)=1/2=0.5' },
  ],
  questions: [
    { id: 'stat-q1', stem: 'Mean of 8,4,6,10,2?', choices: ['5', '6', '7', '8'], correctIndex: 1, explanation: 'Sum=30, ÷5=6.' },
    { id: 'stat-q2', stem: 'Median of 3,7,1,9,5?', choices: ['3', '7', '5', '9'], correctIndex: 2, explanation: 'Order: 1,3,5,7,9. Middle=5.' },
    { id: 'stat-q3', stem: 'Bag: 3 red, 5 blue, 2 green. P(blue)?', choices: ['1/2', '3/10', '5/10', '2/10'], correctIndex: 2, explanation: '5/10=1/2.' },
    { id: 'stat-q4', stem: 'Range of 12,7,3,18,5?', choices: ['11', '13', '15', '18'], correctIndex: 2, explanation: '18−3=15.' },
    { id: 'stat-q5', stem: 'P(rain)=0.3. P(not rain)=?', choices: ['0.3', '0.7', '0.6', '1.3'], correctIndex: 1, explanation: '1−0.3=0.7.' },
  ],
};

const mathNumberPatterns: Topic = {
  id: 'math-patterns-1',
  subjectId: 'math',
  title: 'Number Patterns',
  description: 'Identifying sequences and finding rules using nth term formulas.',
  ibLevel: 'MYP',
  notes: [
    { id: 'pat-n1', heading: 'Arithmetic Sequences', body: 'A sequence where the difference between consecutive terms is constant (common difference d). Example: 3,7,11,15,... has d=4. nth term: a+(n−1)d, where a is the first term.' },
    { id: 'pat-n2', heading: 'The nth Term Formula', body: 'For arithmetic sequences: T(n)=dn+c where d=common difference. Example: 5,8,11,14,... → d=3, T(n)=3n+2. Check: n=2 gives 3(2)+2=8 ✓.' },
    { id: 'pat-n3', heading: 'Other Patterns', body: 'Geometric: multiply by a fixed ratio (2,6,18,54,... r=3). Square numbers: 1,4,9,16,25,... Triangular numbers: 1,3,6,10,15,... Check differences — if first differences constant = arithmetic; second differences constant = n² term.' },
  ],
  flashcards: [
    { id: 'pat-f1', term: 'Arithmetic sequence', definition: 'Constant difference between consecutive terms.', example: '5,9,13,17,... (d=4)' },
    { id: 'pat-f2', term: 'Common difference', definition: 'Fixed amount added each term in an arithmetic sequence.', example: '2,5,8,11,... d=3' },
    { id: 'pat-f3', term: 'nth term', definition: 'Formula giving value of any term by its position n.', example: '4n−1: n=1→3, n=2→7, n=3→11' },
    { id: 'pat-f4', term: 'Geometric sequence', definition: 'Each term multiplied by a fixed ratio.', example: '3,6,12,24,... (r=2)' },
    { id: 'pat-f5', term: 'Square numbers', definition: 'Numbers from multiplying a whole number by itself: 1,4,9,16,25,...', example: '6²=36' },
  ],
  questions: [
    { id: 'pat-q1', stem: 'Common difference of 7,11,15,19,...?', choices: ['3', '4', '7', '2'], correctIndex: 1, explanation: '11−7=4, 15−11=4, 19−15=4. d=4.' },
    { id: 'pat-q2', stem: 'nth term = 3n+2. 5th term?', choices: ['15', '17', '13', '20'], correctIndex: 1, explanation: '3(5)+2=15+2=17.' },
    { id: 'pat-q3', stem: 'Which is geometric?', choices: ['2,5,8,11,...', '1,4,9,16,...', '3,6,12,24,...', '10,8,6,4,...'], correctIndex: 2, explanation: '3×2=6, 6×2=12, 12×2=24. Common ratio=2.' },
    { id: 'pat-q4', stem: 'nth term for 4,7,10,13,...?', choices: ['2n+2', '3n+1', '4n', 'n+3'], correctIndex: 1, explanation: 'd=3. n=1: 3(1)=3, but first=4, so +1. 3n+1.' },
    { id: 'pat-q5', stem: 'Next term: 2,6,18,54,...?', choices: ['72', '108', '162', '108'], correctIndex: 2, explanation: '54×3=162.' },
  ],
};

// Existing MYP topics from MathMYPNewTopics (representative subset)
const mathRatioProportion: Topic = {
  id: 'math-ratio-myp',
  subjectId: 'math',
  title: 'Ratio & Proportion',
  description: 'Simplifying ratios, dividing quantities, direct and inverse proportion, and real-world applications.',
  ibLevel: 'MYP',
  notes: [
    { id: 'ratio-n1', heading: 'Simplifying Ratios', body: 'A ratio compares quantities. Simplify by dividing all parts by their HCF. Example: 12:18 → HCF=6 → 2:3. To divide a quantity in a ratio, add the parts to find total shares, divide by total, then multiply each part.' },
    { id: 'ratio-n2', heading: 'Direct and Inverse Proportion', body: 'Direct proportion: y=kx (both increase together). Example: 5 pens cost £2.50 → 8 pens = (2.50÷5)×8 = £4.00. Inverse proportion: y=k/x (one increases as other decreases). Example: 4 workers take 6 days → 8 workers take 3 days.' },
    { id: 'ratio-n3', heading: 'Map Scales and Best Value', body: 'Map scale 1:50000 means 1cm = 500m. Best value: compare unit price (cost per gram or per item). Example: 400g for £1.60 = 0.4p/g; 600g for £2.10 = 0.35p/g → larger pack is better value.' },
  ],
  flashcards: [
    { id: 'ratio-f1', term: 'Ratio', definition: 'Comparison of quantities using colon notation.', example: '15:20 simplifies to 3:4.' },
    { id: 'ratio-f2', term: 'Direct proportion', definition: 'y=kx; quantities increase together.', example: '3m of fabric costs £12; 7m costs £28.' },
    { id: 'ratio-f3', term: 'Inverse proportion', definition: 'y=k/x; one increases as other decreases.', example: '6 workers→8 days; 12 workers→4 days.' },
    { id: 'ratio-f4', term: 'Unitary method', definition: 'Find the value of one unit first, then scale.', example: '5 tickets £35 → 1 ticket £7 → 9 tickets £63.' },
    { id: 'ratio-f5', term: 'Map scale', definition: 'Ratio relating map distance to real-world distance.', example: '1:25000 → 4cm on map = 1km real.' },
  ],
  questions: [
    { id: 'ratio-q1', stem: 'Simplify 36:48.', choices: ['9:12', '4:3', '3:4', '6:8'], correctIndex: 2, explanation: 'HCF=12. 36÷12=3, 48÷12=4 → 3:4.' },
    { id: 'ratio-q2', stem: 'Divide £120 in ratio 2:3.', choices: ['£48, £72', '£40, £80', '£60, £60', '£24, £96'], correctIndex: 0, explanation: '5 shares, £24 per share: 2×£24=£48, 3×£24=£72.' },
    { id: 'ratio-q3', stem: '8 pens cost £5.60. How much for 5 pens?', choices: ['£3.00', '£3.50', '£4.00', '£2.80'], correctIndex: 1, explanation: '£5.60÷8=£0.70 per pen. 5×£0.70=£3.50.' },
    { id: 'ratio-q4', stem: 'y∝x; x=4, y=20. Find y when x=7.', choices: ['28', '35', '42', '56'], correctIndex: 1, explanation: 'k=5; y=5×7=35.' },
    { id: 'ratio-q5', stem: 'y∝1/x; x=3, y=12. Find y when x=9.', choices: ['36', '6', '4', '2'], correctIndex: 2, explanation: 'k=36; y=36÷9=4.' },
  ],
};

const mathLinearGraphs: Topic = {
  id: 'math-linear-myp',
  subjectId: 'math',
  title: 'Linear Graphs & Functions',
  description: 'Plotting coordinates, gradient, y-intercept, the equation y=mx+c, and parallel and perpendicular lines.',
  ibLevel: 'MYP',
  notes: [
    { id: 'lin-n1', heading: 'Gradient and y-Intercept', body: 'Gradient m = (y₂−y₁)÷(x₂−x₁) measures steepness. Positive = upward, negative = downward, zero = horizontal. y-intercept c is where the line crosses the y-axis (x=0).' },
    { id: 'lin-n2', heading: 'y = mx + c', body: 'Every straight line can be written as y=mx+c. Given gradient and one point, use y−y₁=m(x−x₁). Given two points, find m first, then substitute to find c. Example: (1,3) and (3,7): m=2, c=1 → y=2x+1.' },
    { id: 'lin-n3', heading: 'Parallel and Perpendicular', body: 'Parallel: same gradient (m₁=m₂). Perpendicular: m₁×m₂=−1 (negative reciprocals). Example: gradient 2 is perpendicular to −1/2.' },
  ],
  flashcards: [
    { id: 'lin-f1', term: 'Gradient', definition: 'Measure of steepness: (change in y)÷(change in x).', example: '(2,1)→(6,9): m=8÷4=2.' },
    { id: 'lin-f2', term: 'y-intercept', definition: 'Where line crosses y-axis (x=0), the c in y=mx+c.', example: 'y=3x−5 → y-intercept = −5.' },
    { id: 'lin-f3', term: 'y=mx+c', definition: 'Standard straight line equation: m=gradient, c=y-intercept.', example: 'y=−2x+7: m=−2, c=7.' },
    { id: 'lin-f4', term: 'Parallel lines', definition: 'Same gradient, never intersect.', example: 'y=4x+1 ∥ y=4x−3 (both m=4).' },
    { id: 'lin-f5', term: 'Perpendicular lines', definition: 'm₁×m₂=−1 (negative reciprocals).', example: 'm=3 ⊥ m=−1/3.' },
  ],
  questions: [
    { id: 'lin-q1', stem: 'Gradient of line through (1,2) and (5,10)?', choices: ['1', '2', '3', '4'], correctIndex: 1, explanation: '(10−2)÷(5−1)=8÷4=2.' },
    { id: 'lin-q2', stem: 'y-intercept of y=3x−4?', choices: ['3', '4', '−4', '−3'], correctIndex: 2, explanation: 'In y=mx+c, c=−4.' },
    { id: 'lin-q3', stem: 'Which is parallel to y=2x+5?', choices: ['y=−2x+5', 'y=2x−3', 'y=5x+2', 'y=3x+5'], correctIndex: 1, explanation: 'Same gradient m=2.' },
    { id: 'lin-q4', stem: 'Gradient perpendicular to y=4x+1?', choices: ['4', '1/4', '−4', '−1/4'], correctIndex: 3, explanation: 'Negative reciprocal: −1/4.' },
    { id: 'lin-q5', stem: 'Line with gradient 3 through (0,−2)?', choices: ['y=−2x+3', 'y=3x−2', 'y=3x+2', 'y=2x−3'], correctIndex: 1, explanation: 'y-intercept=−2, gradient=3 → y=3x−2.' },
  ],
};

const mathPowers: Topic = {
  id: 'math-powers-myp',
  subjectId: 'math',
  title: 'Powers, Roots & Indices',
  description: 'Index notation, the index laws, zero and negative indices, fractional indices, and standard form (scientific notation).',
  ibLevel: 'MYP',
  notes: [
    { id: 'pow-n1', heading: 'Index Notation and Laws', body: 'Index notation: 2⁵ = 2×2×2×2×2 = 32. The three fundamental index laws: (1) Multiplication law: aᵐ × aⁿ = aᵐ⁺ⁿ. (2) Division law: aᵐ ÷ aⁿ = aᵐ⁻ⁿ. (3) Power of a power: (aᵐ)ⁿ = aᵐⁿ. These laws only apply when the bases are identical.' },
    { id: 'pow-n2', heading: 'Zero, Negative, and Fractional Indices', body: 'Zero index: a⁰ = 1 (any non-zero base). Negative index: a⁻ⁿ = 1/aⁿ (e.g., 3⁻² = 1/9). Fractional index: a^(1/n) = ⁿ√a (e.g., 64^(1/3) = ∛64 = 4). Combined: a^(m/n) = (ⁿ√a)ᵐ (e.g., 8^(2/3) = (∛8)² = 4).' },
    { id: 'pow-n3', heading: 'Standard Form (Scientific Notation)', body: 'Standard form writes numbers as A × 10ⁿ where 1 ≤ A < 10 and n is an integer. e.g., 45,000 = 4.5 × 10⁴; 0.0032 = 3.2 × 10⁻³. Multiply: multiply A values and add powers; divide: divide A values, subtract powers. Adjust if A falls outside [1, 10).' },
    { id: 'pow-n4', heading: 'Square Roots, Cube Roots, and Estimation', body: '√x is the value that, when squared, gives x. ∛x is the value that, when cubed, gives x. To estimate non-perfect roots, identify the two perfect squares/cubes it lies between. e.g., √50 lies between √49=7 and √64=8, so √50 ≈ 7.1.' },
  ],
  flashcards: [
    { id: 'pow-f1', term: 'Index (exponent)', definition: 'The small raised number saying how many times to multiply the base by itself.', example: '5³ = 5 × 5 × 5 = 125.' },
    { id: 'pow-f2', term: 'Multiplication index law', definition: 'aᵐ × aⁿ = aᵐ⁺ⁿ', example: 'x⁴ × x³ = x⁷' },
    { id: 'pow-f3', term: 'Division index law', definition: 'aᵐ ÷ aⁿ = aᵐ⁻ⁿ', example: 'y⁶ ÷ y² = y⁴' },
    { id: 'pow-f4', term: 'Power of a power', definition: '(aᵐ)ⁿ = aᵐⁿ', example: '(x³)⁴ = x¹²' },
    { id: 'pow-f5', term: 'Zero index', definition: 'a⁰ = 1 (any non-zero base)', example: '100⁰ = 1, (−7)⁰ = 1' },
    { id: 'pow-f6', term: 'Negative index', definition: 'a⁻ⁿ = 1/aⁿ', example: '2⁻³ = 1/8' },
    { id: 'pow-f7', term: 'Fractional index', definition: 'a^(1/n) = ⁿ√a; a^(m/n) = (ⁿ√a)ᵐ', example: '27^(2/3) = (∛27)² = 9' },
    { id: 'pow-f8', term: 'Standard form', definition: 'A × 10ⁿ where 1 ≤ A < 10 and n is an integer.', example: '0.00047 = 4.7 × 10⁻⁴' },
  ],
  questions: [
    { id: 'pow-q1', stem: 'What is 3⁴?', choices: ['12', '64', '81', '27'], correctIndex: 2, explanation: '3⁴ = 3×3×3×3 = 81.' },
    { id: 'pow-q2', stem: 'Simplify x⁵ × x³.', choices: ['x⁸', 'x¹⁵', 'x²', '2x⁸'], correctIndex: 0, explanation: 'Add indices: x⁵⁺³ = x⁸.' },
    { id: 'pow-q3', stem: 'What is 5⁰?', choices: ['0', '5', '1', '50'], correctIndex: 2, explanation: 'Any non-zero base to power 0 equals 1.' },
    { id: 'pow-q4', stem: 'Express 2⁻⁴ as a fraction.', choices: ['1/4', '1/8', '1/16', '−16'], correctIndex: 2, explanation: '2⁻⁴ = 1/2⁴ = 1/16.' },
    { id: 'pow-q5', stem: 'Evaluate 8^(2/3).', choices: ['2', '4', '16', '64'], correctIndex: 1, explanation: '(∛8)² = 2² = 4.' },
    { id: 'pow-q6', stem: 'Write 0.000052 in standard form.', choices: ['52 × 10⁻⁶', '5.2 × 10⁻⁵', '5.2 × 10⁵', '0.52 × 10⁻⁴'], correctIndex: 1, explanation: 'Move decimal 5 places right → 5.2 × 10⁻⁵.' },
    { id: 'pow-q7', stem: 'What is 64^(1/2)?', choices: ['8', '32', '4', '16'], correctIndex: 0, explanation: '√64 = 8.' },
    { id: 'pow-q8', stem: 'Simplify (2x²y³)³.', choices: ['6x⁵y⁶', '8x⁵y⁶', '8x⁶y⁹', '6x⁶y⁹'], correctIndex: 2, explanation: '2³=8, (x²)³=x⁶, (y³)³=y⁹ → 8x⁶y⁹.' },
    { id: 'pow-q9', stem: 'Simplify a⁸ × a⁻³.', choices: ['a¹¹', 'a⁵', 'a⁻²⁴', 'a²⁴'], correctIndex: 1, explanation: 'a⁸ × a⁻³ = a⁸⁺⁽⁻³⁾ = a⁵.' },
    { id: 'pow-q10', stem: '(2 × 10³) × (4 × 10⁵) in standard form:', choices: ['8 × 10⁸', '8 × 10¹⁵', '6 × 10⁸', '8 × 10⁷'], correctIndex: 0, explanation: '2×4=8, 10³×10⁵=10⁸ → 8 × 10⁸.' },
  ],
};

const mathSimultaneous: Topic = {
  id: 'math-simultaneous-myp',
  subjectId: 'math',
  title: 'Simultaneous Equations',
  description: 'Solving two equations in two unknowns by elimination, substitution, and graphical methods.',
  ibLevel: 'MYP',
  notes: [
    { id: 'sim-n1', heading: 'Solving by Elimination', body: 'Add or subtract equations to remove one variable. If coefficients of one variable match (or are opposites), add/subtract directly. If not, multiply one or both equations first. Example: 2x+3y=12 and 4x−3y=6 → add to get 6x=18 → x=3. Substitute back: 2(3)+3y=12 → y=2. Always verify in both equations.' },
    { id: 'sim-n2', heading: 'Solving by Substitution', body: 'Rearrange one equation to express one variable in terms of the other, then substitute into the second. Example: x+2y=8 and 3x−y=3 → from first: x=8−2y. Substitute: 3(8−2y)−y=3 → 24−7y=3 → y=3 → x=2. Efficient when one variable has coefficient 1.' },
    { id: 'sim-n3', heading: 'Graphical Interpretation', body: 'Each linear equation is a straight line. The solution is the intersection point (x, y). If lines are parallel (same gradient) → no solution. If lines are identical → infinitely many solutions.' },
    { id: 'sim-n4', heading: 'Forming Equations from Word Problems', body: 'Identify two unknowns (x, y) and translate each piece of information into an equation. Example: "Two apples and three bananas cost £1.60; one apple and five bananas cost £2.00." → 2x+3y=1.60, x+5y=2.00. Solve and interpret in context.' },
  ],
  flashcards: [
    { id: 'sim-f1', term: 'Simultaneous equations', definition: 'A set of two or more equations that share variables and must all be satisfied at the same time.', example: '2x+y=7 and x−y=2; both true when x=3, y=1.' },
    { id: 'sim-f2', term: 'Elimination method', definition: 'Add or subtract equations to eliminate one variable, then solve for the other.', example: 'Add 3x+2y=11 and x−2y=1 → 4x=12 → x=3.' },
    { id: 'sim-f3', term: 'Substitution method', definition: 'Express one variable in terms of the other, then substitute into the second equation.', example: 'From y=3x−1, substitute into 2x+y=9.' },
    { id: 'sim-f4', term: 'Point of intersection', definition: 'The coordinates (x, y) where two lines cross — the solution to the simultaneous equations.', example: 'y=x+1 and y=3−x intersect at (1, 2).' },
    { id: 'sim-f5', term: 'No solution', definition: 'When two lines are parallel (same gradient, different y-intercepts), there is no intersection.', example: 'y=2x+1 and y=2x+5 are parallel.' },
    { id: 'sim-f6', term: 'Checking a solution', definition: 'Substitute x and y into BOTH original equations to verify.', example: 'x=2, y=3: 2(2)+3=7 ✓ and 2−3=−1 ✓.' },
  ],
  questions: [
    { id: 'sim-q1', stem: 'Solve: x + y = 10 and x − y = 4.', choices: ['x=6, y=4', 'x=7, y=3', 'x=4, y=6', 'x=8, y=2'], correctIndex: 1, explanation: 'Add: 2x=14 → x=7. Substitute: 7+y=10 → y=3.' },
    { id: 'sim-q2', stem: 'Solve by substitution: y = 2x − 1 and 3x + y = 14.', choices: ['x=2, y=3', 'x=3, y=5', 'x=4, y=7', 'x=5, y=9'], correctIndex: 1, explanation: '3x+2x−1=14 → 5x=15 → x=3 → y=5.' },
    { id: 'sim-q3', stem: 'Two lines: y=x+2 and y=−x+6. Intersection?', choices: ['(2, 4)', '(4, 2)', '(3, 5)', '(1, 3)'], correctIndex: 0, explanation: 'x+2=−x+6 → 2x=4 → x=2 → y=4.' },
    { id: 'sim-q4', stem: 'Solve: 3x + 2y = 16 and 5x − 2y = 8.', choices: ['x=2, y=5', 'x=3, y=3.5', 'x=4, y=2', 'x=1, y=6.5'], correctIndex: 1, explanation: 'Add: 8x=24 → x=3 → 9+2y=16 → y=3.5.' },
    { id: 'sim-q5', stem: 'Sum of two numbers is 20, difference is 6. Larger number?', choices: ['7', '10', '13', '14'], correctIndex: 2, explanation: 'x+y=20, x−y=6 → 2x=26 → x=13 (larger).' },
    { id: 'sim-q6', stem: 'Solve: 4x + y = 14 and 2x + y = 8.', choices: ['x=2, y=6', 'x=3, y=2', 'x=4, y=−2', 'x=1, y=10'], correctIndex: 1, explanation: 'Subtract: 2x=6 → x=3 → 12+y=14 → y=2.' },
    { id: 'sim-q7', stem: 'y=3x−4 and y=3x+1. How many intersection points?', choices: ['0', '1', '2', 'Infinitely many'], correctIndex: 0, explanation: 'Both have gradient 3 but different y-intercepts → parallel, no intersection.' },
    { id: 'sim-q8', stem: 'Rectangle perimeter 28cm, length is 4cm more than width. Length?', choices: ['5 cm', '8 cm', '9 cm', '10 cm'], correctIndex: 2, explanation: 'l+w=14, l=w+4 → 2w+4=14 → w=5 → l=9 cm.' },
    { id: 'sim-q9', stem: 'Solve by substitution: x = 3y and 2x + y = 35.', choices: ['x=3, y=1', 'x=15, y=5', 'x=21, y=7', 'x=10, y=15'], correctIndex: 1, explanation: '2(3y)+y=35 → 7y=35 → y=5 → x=15.' },
    { id: 'sim-q10', stem: 'A cinema: adult £9, child £5. 8 tickets total £56. How many adults?', choices: ['2', '3', '4', '5'], correctIndex: 2, explanation: 'a+c=8, 9a+5c=56 → c=8−a → 9a+40−5a=56 → 4a=16 → a=4.' },
  ],
};

const mathInequalities: Topic = {
  id: 'math-inequalities-myp',
  subjectId: 'math',
  title: 'Inequalities',
  description: 'Solving and representing linear inequalities, compound inequalities, and graphical inequalities on a coordinate plane.',
  ibLevel: 'MYP',
  notes: [
    { id: 'ine-n1', heading: 'Solving Linear Inequalities', body: 'Solve like equations, but with one critical exception: when multiplying or dividing both sides by a negative number, REVERSE the inequality sign. Example: −2x < 6 → x > −3.' },
    { id: 'ine-n2', heading: 'Number Line Representation', body: 'Open circle (○) = value NOT included (< or >). Filled circle (●) = value IS included (≤ or ≥). Arrow extends in the direction of all satisfying values. Compound inequality: −1 < x ≤ 5 shown with open circle at −1, filled at 5, segment shaded between.' },
    { id: 'ine-n3', heading: 'Compound Inequalities', body: 'Solve by applying operations to all three parts. Example: −2 ≤ 3x+1 < 10 → −3 ≤ 3x < 9 → −1 ≤ x < 3. Solutions include all values from −1 to 3 (including −1, excluding 3).' },
    { id: 'ine-n4', heading: 'Graphical Inequalities', body: 'Draw the boundary line. Use solid if ≤ or ≥ (boundary included), dashed if < or > (boundary excluded). Test a point (e.g., (0,0)) to determine which side to shade. Multiple inequalities give a feasible region.' },
  ],
  flashcards: [
    { id: 'ine-f1', term: 'Inequality', definition: 'A mathematical statement showing two expressions are not equal, using <, >, ≤, or ≥.', example: '3x−1 > 8' },
    { id: 'ine-f2', term: 'Reversing the sign', definition: 'When multiplying or dividing by a negative number, flip the inequality sign.', example: '−3x < 12 → x > −4' },
    { id: 'ine-f3', term: 'Open circle', definition: 'Used at an endpoint to indicate the value is NOT included (< or >).', example: 'x > 5: open circle at 5.' },
    { id: 'ine-f4', term: 'Filled circle', definition: 'Used at an endpoint to indicate the value IS included (≤ or ≥).', example: 'x ≤ −2: filled circle at −2.' },
    { id: 'ine-f5', term: 'Compound inequality', definition: 'An inequality with two conditions bounding a variable between two values.', example: '−3 < x ≤ 7' },
    { id: 'ine-f6', term: 'Boundary line', definition: 'The line forming the edge of a shaded region. Solid if included (≤, ≥); dashed if not (< or >).', example: 'y ≤ 2x+1 has a solid line.' },
  ],
  questions: [
    { id: 'ine-q1', stem: 'Solve: x + 7 > 12.', choices: ['x > 5', 'x < 5', 'x > 19', 'x ≥ 5'], correctIndex: 0, explanation: 'x > 12−7 = 5.' },
    { id: 'ine-q2', stem: 'Solve: −2x < 10.', choices: ['x < −5', 'x > −5', 'x < 5', 'x > 5'], correctIndex: 1, explanation: 'Divide by −2; reverse sign: x > −5.' },
    { id: 'ine-q3', stem: 'x ≥ 3 on a number line:', choices: ['Open circle at 3, arrow left', 'Open circle at 3, arrow right', 'Filled circle at 3, arrow left', 'Filled circle at 3, arrow right'], correctIndex: 3, explanation: '≥ includes 3 (filled) and all values greater (arrow right).' },
    { id: 'ine-q4', stem: 'Integer solutions of −2 < x ≤ 3:', choices: ['−1, 0, 1, 2, 3', '−2, −1, 0, 1, 2, 3', '−1, 0, 1, 2', '0, 1, 2, 3'], correctIndex: 0, explanation: 'Strict at −2 (excluded), ≤ at 3 (included). Integers: −1, 0, 1, 2, 3.' },
    { id: 'ine-q5', stem: 'Solve: 1 ≤ 2x − 3 < 9.', choices: ['2 ≤ x < 6', '−1 ≤ x < 3', '2 < x ≤ 6', '4 ≤ x < 12'], correctIndex: 0, explanation: 'Add 3: 4 ≤ 2x < 12 → 2 ≤ x < 6.' },
    { id: 'ine-q6', stem: 'Bag holds at most 12kg. Already 7.5kg packed, each extra item 0.5kg. Max items?', choices: ['8', '9', '10', '12'], correctIndex: 1, explanation: '7.5+0.5n ≤ 12 → 0.5n ≤ 4.5 → n ≤ 9.' },
    { id: 'ine-q7', stem: 'Solve: 3 − 2x ≥ −7.', choices: ['x ≤ 5', 'x ≥ 5', 'x ≤ −5', 'x ≥ −5'], correctIndex: 0, explanation: '−2x ≥ −10 → x ≤ 5 (flip sign).' },
    { id: 'ine-q8', stem: '2x+3 < 2x−1 has how many solutions?', choices: ['Infinitely many', 'One', 'Two', 'No solution'], correctIndex: 3, explanation: '0x+3 < −1 → 3 < −1 is always false. No solution.' },
    { id: 'ine-q9', stem: 'Solve: 2(x − 3) < 4.', choices: ['x < 1', 'x < 5', 'x > 1', 'x > 5'], correctIndex: 1, explanation: '2x−6 < 4 → 2x < 10 → x < 5.' },
    { id: 'ine-q10', stem: 'For y > 3x − 2, which is correct?', choices: ['Solid line, shade above', 'Dashed line, shade above', 'Dashed line, shade below', 'Solid line, shade below'], correctIndex: 1, explanation: 'Strict (>) → dashed boundary; y > = shade above the line.' },
  ],
};

const mathPythagoras: Topic = {
  id: 'math-pythagoras-myp',
  subjectId: 'math',
  title: "Pythagoras' Theorem",
  description: 'Using a² + b² = c² to find unknown sides in right-angled triangles, Pythagorean triples, and 2D and 3D applications.',
  ibLevel: 'MYP',
  notes: [
    { id: 'pyt-n1', heading: 'The Theorem and Finding the Hypotenuse', body: 'In any right-angled triangle: a² + b² = c², where c is the hypotenuse (side opposite the right angle, always longest). To find the hypotenuse: c = √(a²+b²). Example: legs 3 and 4 → c = √(9+16) = 5.' },
    { id: 'pyt-n2', heading: 'Finding a Shorter Side and Pythagorean Triples', body: 'To find a shorter side: a = √(c²−b²). Example: hypotenuse 13, leg 5 → a = √(169−25) = 12. Pythagorean triples: integer sets satisfying the theorem — 3-4-5, 5-12-13, 8-15-17, 7-24-25. Multiples also work (6-8-10 = 2× 3-4-5).' },
    { id: 'pyt-n3', heading: 'Testing for Right Angles and Distance in 2D', body: 'To test if triangle is right-angled: check if a²+b²=c² (where c is the longest). If yes → right-angled; if a²+b²>c² → acute; if a²+b²<c² → obtuse. Distance between (x₁,y₁) and (x₂,y₂): d = √((x₂−x₁)² + (y₂−y₁)²) — a direct Pythagoras application.' },
    { id: 'pyt-n4', heading: '3D Applications', body: 'Space diagonal of cuboid (l×w×h): first find base diagonal d₁=√(l²+w²), then space diagonal d=√(d₁²+h²) = √(l²+w²+h²). Example: 3×4×12: base=5, space=√(25+144)=13.' },
  ],
  flashcards: [
    { id: 'pyt-f1', term: "Pythagoras' theorem", definition: 'In a right-angled triangle: a² + b² = c².', example: 'Legs 5 and 12: c = √(25+144) = 13.' },
    { id: 'pyt-f2', term: 'Hypotenuse', definition: 'The longest side, opposite the right angle.', example: 'In a 3-4-5 triangle, the hypotenuse is 5.' },
    { id: 'pyt-f3', term: 'Pythagorean triple', definition: 'A set of three integers satisfying a² + b² = c².', example: '3-4-5, 5-12-13, 8-15-17.' },
    { id: 'pyt-f4', term: 'Finding a shorter side', definition: 'a = √(c² − b²)', example: 'c=10, b=6 → a = √(100−36) = 8.' },
    { id: 'pyt-f5', term: 'Distance between two points', definition: 'd = √((x₂−x₁)² + (y₂−y₁)²)', example: '(1,2) to (4,6) = √(9+16) = 5.' },
    { id: 'pyt-f6', term: 'Space diagonal', definition: 'd = √(l² + w² + h²) for a cuboid.', example: '2×3×6 → d = √(4+9+36) = 7.' },
  ],
  questions: [
    { id: 'pyt-q1', stem: 'Right triangle: legs 6 and 8. Hypotenuse?', choices: ['10 cm', '12 cm', '14 cm', '√48 cm'], correctIndex: 0, explanation: '√(36+64) = √100 = 10.' },
    { id: 'pyt-q2', stem: 'Hypotenuse 15, leg 9. Other leg?', choices: ['6 cm', '10 cm', '12 cm', '√306 cm'], correctIndex: 2, explanation: '√(225−81) = √144 = 12.' },
    { id: 'pyt-q3', stem: 'Which is a Pythagorean triple?', choices: ['3, 5, 6', '5, 12, 13', '7, 10, 12', '4, 6, 8'], correctIndex: 1, explanation: '25+144=169=13² ✓.' },
    { id: 'pyt-q4', stem: 'Distance between (1, 1) and (4, 5)?', choices: ['3', '4', '5', '7'], correctIndex: 2, explanation: '√((4−1)²+(5−1)²) = √(9+16) = 5.' },
    { id: 'pyt-q5', stem: 'Ladder 10m, base 6m from wall. Height up wall?', choices: ['6 m', '7 m', '8 m', '9 m'], correctIndex: 2, explanation: '√(100−36) = √64 = 8.' },
    { id: 'pyt-q6', stem: 'Cuboid 3cm × 4cm × 12cm. Space diagonal?', choices: ['13 cm', '√169 cm', '19 cm', '√153 cm'], correctIndex: 0, explanation: '√(9+16+144) = √169 = 13.' },
    { id: 'pyt-q7', stem: 'Triangle sides 7, 24, 25. Right-angled?', choices: ['Yes, 7²+24²=25²', 'No', 'Cannot determine', 'Only if isosceles'], correctIndex: 0, explanation: '49+576=625=25² ✓.' },
    { id: 'pyt-q8', stem: 'Rectangle 5cm × 12cm. Diagonal length?', choices: ['13 cm', '17 cm', '√119 cm', '10 cm'], correctIndex: 0, explanation: '√(25+144) = √169 = 13.' },
    { id: 'pyt-q9', stem: 'Space diagonal of cube with side a:', choices: ['a√2', 'a√3', 'a√4=2a', '2a√2'], correctIndex: 1, explanation: '√(a²+a²+a²) = √(3a²) = a√3.' },
    { id: 'pyt-q10', stem: 'Which does NOT form a right triangle?', choices: ['6, 8, 10', '5, 12, 13', '8, 15, 17', '4, 5, 6'], correctIndex: 3, explanation: '16+25=41≠36. Not right-angled.' },
  ],
};

const mathTrigBasic: Topic = {
  id: 'math-trig-basic-myp',
  subjectId: 'math',
  title: 'Basic Trigonometry – SOH CAH TOA',
  description: 'Labelling triangle sides, using sin/cos/tan ratios, angles of elevation and depression, exact values, and bearings.',
  ibLevel: 'MYP',
  notes: [
    { id: 'tba-n1', heading: 'Labelling Sides and SOH CAH TOA', body: 'In a right-angled triangle, relative to angle θ: Hypotenuse (H) = opposite right angle, longest side. Opposite (O) = side across from θ. Adjacent (A) = side next to θ (not hypotenuse). Ratios: sin θ = O/H (SOH), cos θ = A/H (CAH), tan θ = O/A (TOA).' },
    { id: 'tba-n2', heading: 'Finding Unknown Sides', body: 'Choose the ratio connecting known and unknown sides. Example: find O when H=10, θ=30°: sin 30° = O/10 → O = 10×0.5 = 5. To find A when O known: A = O÷tan θ. Always use degree mode on calculator.' },
    { id: 'tba-n3', heading: 'Finding Unknown Angles', body: 'Use inverse trig functions. Example: sin θ = 0.6 → θ = sin⁻¹(0.6) ≈ 36.9°. If tan θ = O/A = 7/4 = 1.75 → θ = tan⁻¹(1.75) ≈ 60.3°. Inverse functions: sin⁻¹, cos⁻¹, tan⁻¹ (also arcsin, arccos, arctan).' },
    { id: 'tba-n4', heading: 'Exact Values, Elevation, Depression, and Bearings', body: 'Memorise: sin 30° = 1/2, cos 30° = √3/2, tan 30° = 1/√3; sin 45° = cos 45° = 1/√2, tan 45° = 1; sin 60° = √3/2, cos 60° = 1/2, tan 60° = √3. Angle of elevation: upward from horizontal. Angle of depression: downward from horizontal.' },
  ],
  flashcards: [
    { id: 'tba-f1', term: 'Hypotenuse', definition: 'The longest side, opposite the right angle.', example: 'In a 3-4-5 triangle, 5 is the hypotenuse.' },
    { id: 'tba-f2', term: 'SOH', definition: 'sin θ = Opposite ÷ Hypotenuse.', example: 'sin 30° = 0.5; if H=10, O=5.' },
    { id: 'tba-f3', term: 'CAH', definition: 'cos θ = Adjacent ÷ Hypotenuse.', example: 'cos 60° = 0.5; if H=8, A=4.' },
    { id: 'tba-f4', term: 'TOA', definition: 'tan θ = Opposite ÷ Adjacent.', example: 'tan 45° = 1; if A=6, O=6.' },
    { id: 'tba-f5', term: 'Inverse trigonometry', definition: 'θ = sin⁻¹(O/H), θ = cos⁻¹(A/H), or θ = tan⁻¹(O/A).', example: 'tan θ = 1.5 → θ ≈ 56.3°.' },
    { id: 'tba-f6', term: 'Angle of elevation', definition: 'Angle measured upward from the horizontal to a line of sight.', example: 'Looking up at a building top.' },
    { id: 'tba-f7', term: 'Angle of depression', definition: 'Angle measured downward from the horizontal to a line of sight.', example: 'A bird looking down at a worm.' },
    { id: 'tba-f8', term: 'Exact trig values', definition: 'sin30=1/2, sin60=√3/2, sin45=1/√2; cos is complementary; tan = sin/cos.', example: 'tan 60° = √3.' },
  ],
  questions: [
    { id: 'tba-q1', stem: 'In a right-angled triangle, which side is always opposite the right angle?', choices: ['Adjacent', 'Opposite', 'Hypotenuse', 'Base'], correctIndex: 2, explanation: 'The hypotenuse is always opposite the right angle, longest side.' },
    { id: 'tba-q2', stem: 'sin 30° =?', choices: ['√3/2', '1/2', '1/√2', '1'], correctIndex: 1, explanation: 'sin 30° = 1/2 (exact value to memorise).' },
    { id: 'tba-q3', stem: 'tan 60° =?', choices: ['1', '1/√3', '√3', '2'], correctIndex: 2, explanation: 'tan 60° = √3 (exact value).' },
    { id: 'tba-q4', stem: 'Triangle: hypotenuse 12, angle 40°, sin 40°≈0.643. Opposite side?', choices: ['5.14 cm', '7.71 cm', '9.19 cm', '18.67 cm'], correctIndex: 1, explanation: 'O = H×sinθ = 12×0.643 = 7.71.' },
    { id: 'tba-q5', stem: 'Opposite 7, adjacent 7. What is θ?', choices: ['30°', '45°', '60°', '90°'], correctIndex: 1, explanation: 'tan θ = 7/7 = 1 → θ = 45°.' },
    { id: 'tba-q6', stem: 'cos 45° =?', choices: ['1/2', '√3/2', '1/√2', '√2'], correctIndex: 2, explanation: 'cos 45° = 1/√2 = √2/2.' },
    { id: 'tba-q7', stem: 'Tree 15m tall, observer 20m from base. Angle of elevation? (tan⁻¹(0.75)≈36.9°)', choices: ['30.0°', '36.9°', '41.4°', '53.1°'], correctIndex: 1, explanation: 'tan θ = 15/20 = 0.75 → θ ≈ 36.9°.' },
    { id: 'tba-q8', stem: 'sin θ = 5/10 = 0.5. Find θ.', choices: ['20°', '30°', '45°', '60°'], correctIndex: 1, explanation: 'sin θ = 0.5 → θ = 30°.' },
    { id: 'tba-q9', stem: 'Ladder 6m makes 70° with ground. Height up wall? (sin 70°≈0.940)', choices: ['2.05 m', '5.14 m', '5.64 m', '6.40 m'], correctIndex: 2, explanation: 'H = 6 × 0.940 = 5.64 m.' },
    { id: 'tba-q10', stem: 'Which ratio to find hypotenuse when angle and adjacent are given?', choices: ['sin θ = A/H', 'cos θ = A/H', 'tan θ = O/A', 'sin θ = O/H'], correctIndex: 1, explanation: 'CAH: cos θ = A/H → H = A/cos θ.' },
  ],
};













export const mathSubject: Subject = {
  id: 'math',
  name: 'Math',
  icon: 'function',
  accentColor: '#3B82F6',
  topics: [
    ...yr7MathTopics,
    mathAlgebraBasics,
    mathFractionsPercentages,
    mathGeometry,
    mathStatistics,
    mathNumberPatterns,
    mathRatioProportion,
    mathLinearGraphs,
    mathPowers,
    mathSimultaneous,
    mathInequalities,
    mathPythagoras,
    mathTrigBasic,
    mathDPSequences,
    mathDPExponents,
    mathDPBinomial,
    mathDPFunctions,
    mathDPQuadratics,
    mathDPExpLog,
    mathDPTrig,
    mathDPVectors,
    mathDPDifferentiation,
    mathDPIntegration,
    mathDPProbability,
    mathDPKinematics,
    mathDpDescriptiveStatistics,
    mathDpComplexNumbers,
    mathDpMatrices,
    mathDpCorrelationRegression,
    mathDpPoissonDistribution,
    mathDpHypothesisTesting,
  ],
};
