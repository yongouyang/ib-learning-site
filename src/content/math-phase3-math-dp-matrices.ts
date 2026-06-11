import { Topic } from './types';

const mathDpMatrices: Topic = {
  id: 'math-dp-matrices',
  subjectId: 'math',
  title: 'Matrices',
  description: 'Introduction to matrices, matrix operations, determinants and inverses, and solving systems of linear equations using matrices.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-matrices-n1',
      heading: 'Introduction to Matrices',
      body: 'A matrix is a powerful way to organise numbers, data, or equations into a rectangular grid. You will use matrices to represent transformations, solve systems of equations, and model real-world situations.\n\n📌 Definition\nA matrix is a rectangular array of numbers arranged in rows and columns.\n\nThe order (or size) of a matrix is written as:\n    m × n\nwhere m = number of rows and n = number of columns.\n\nThe element in row i and column j is written as aᵢⱼ.\n\n🔑 Special Matrices\n• Column matrix (or column vector): one column only, e.g. 3 × 1\n• Row matrix: one row only, e.g. 1 × 3\n• Square matrix: same number of rows and columns, e.g. 2 × 2\n• Zero matrix O: every element is 0\n• Identity matrix I: square matrix with 1s on the leading diagonal and 0s elsewhere\n\n    2 × 2 identity:     I = [[1, 0], [0, 1]]\n    3 × 3 identity:     I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]\n\n📌 Equality of Matrices\nTwo matrices are equal only when:\n1. They have the same order\n2. Every corresponding element is identical\n\n💡 Worked Example\nLet A = [[5, −3, 7], [−1, 2, 4]]\n\n  Step 1: State the order\n    A has 2 rows and 3 columns, so the order is 2 × 3\n\n  Step 2: Identify a specific element\n    a₂,₃ is the element in row 2, column 3\n    a₂,₃ = 4\n\n📎 Key Points to Remember\n• The first number in the order is always rows, the second is columns\n• Identity matrices act like the number 1 in matrix multiplication\n• Zero matrices act like the number 0 in matrix addition\n• Always double-check that two matrices have the same order before comparing elements\n\n⚠️ Common Mistake\nConfusing rows and columns when stating the order. Remember: rows come first, just like reading a book left-to-right then top-to-bottom.',
    },
    {
      id: 'math-dp-matrices-n2',
      heading: 'Operations with Matrices',
      body: 'Matrices can be added, subtracted, and multiplied — but each operation has specific rules you must follow. Mastering these rules is essential for everything that follows.\n\n📌 Addition and Subtraction\nYou can only add or subtract matrices of the same order.\n\nAdd or subtract corresponding elements:\n    (A ± B)ᵢⱼ = aᵢⱼ ± bᵢⱼ\n\nProperties:\n• A + B = B + A          (commutative)\n• (A + B) + C = A + (B + C)   (associative)\n• A + O = A\n• A − B = A + (−B)\n\n🔑 Scalar Multiplication\nMultiply every element by the scalar k:\n    kA = (k × aᵢⱼ)\n\nThe order stays the same. A negative scalar changes the sign of every element.\n\n💡 Worked Example — Addition and Subtraction\nLet A = [[−4, 2], [7, 3], [1, −5]] and B = [[2, 6], [5, −9], [−2, −3]]\n\n  Step 1: Check orders\n    Both are 3 × 2, so addition and subtraction are possible\n\n  Step 2: Add corresponding elements\n    A + B = [[−4+2, 2+6], [7+5, 3+(−9)], [1+(−2), −5+(−3)]]\n    A + B = [[−2, 8], [12, −6], [−1, −8]]\n\n  Step 3: Subtract corresponding elements\n    A − B = [[−4−2, 2−6], [7−5, 3−(−9)], [1−(−2), −5−(−3)]]\n    A − B = [[−6, −4], [2, 12], [3, −2]]\n\n📌 Matrix Multiplication\nTo multiply AB, the number of columns in A must equal the number of rows in B.\n\nIf A is m × n and B is n × p, then AB is m × p.\n\nThe (i, j) entry of AB is the dot product of row i of A and column j of B:\n    (AB)ᵢⱼ = aᵢ₁b₁ⱼ + aᵢ₂b₂ⱼ + ... + aᵢₙbₙⱼ\n\n🔑 Properties of Matrix Multiplication\n• AB ≠ BA in general          (NOT commutative)\n• A(BC) = (AB)C              (associative)\n• A(B + C) = AB + AC         (distributive)\n• (A + B)C = AC + BC         (distributive)\n• AI = IA = A                (identity law)\n• AO = OA = O\n\n💡 Worked Example — Matrix Multiplication\nLet A = [[2, −1], [4, −1]] and B = [[1, 1], [−4, 0]]\n\n  Step 1: Check if AB is possible\n    A is 2 × 2, B is 2 × 2. Columns of A (2) = rows of B (2). Yes.\n\n  Step 2: Calculate each element of AB\n    Row 1 · Col 1:  (2)(1) + (−1)(−4) = 2 + 4 = 6\n    Row 1 · Col 2:  (2)(1) + (−1)(0) = 2 + 0 = 2\n    Row 2 · Col 1:  (4)(1) + (−1)(−4) = 4 + 4 = 8\n    Row 2 · Col 2:  (4)(1) + (−1)(0) = 4 + 0 = 4\n\n  Step 3: Write the result\n    AB = [[6, 2], [8, 4]]\n\n  Step 4: Calculate BA to show non-commutativity\n    Row 1 · Col 1:  (1)(2) + (1)(4) = 6\n    Row 1 · Col 2:  (1)(−1) + (1)(−1) = −2\n    Row 2 · Col 1:  (−4)(2) + (0)(4) = −8\n    Row 2 · Col 2:  (−4)(−1) + (0)(−1) = 4\n    BA = [[6, −2], [−8, 4]] ≠ AB\n\n📌 Powers of Square Matrices\nFor a square matrix A:\n    A² = AA\n    A³ = AAA\n    and so on\n\n📎 Key Points to Remember\n• You can only add/subtract matrices of the same order\n• Matrix multiplication order matters: AB is not the same as BA\n• The middle dimensions must match for multiplication: (m × n)(n × p) = (m × p)\n• Powers only exist for square matrices\n\n⚠️ Common Mistake\nTrying to multiply matrices when the inner dimensions do not match. Always check: columns of first = rows of second. Another common error is assuming AB = BA — always calculate both sides separately.',
    },
    {
      id: 'math-dp-matrices-n3',
      heading: 'Determinants and Inverses',
      body: 'The determinant is a single number that tells you important information about a square matrix. It is the key to finding inverses and deciding whether a system of equations has a unique solution.\n\n📌 Definition\nThe determinant is a numerical value calculated from the elements of a square matrix. Only square matrices have determinants.\n\n🔑 Determinant of a 2 × 2 Matrix\nFor A = [[a, b], [c, d]]:\n    det(A) = ad − bc\n\nYou can also write this as |A| = ad − bc.\n\n💡 Worked Example — Finding a Determinant\nFind det(A) for A = [[3, −6], [2, 7]]\n\n  Step 1: Identify a, b, c, d\n    a = 3, b = −6, c = 2, d = 7\n\n  Step 2: Apply the formula\n    det(A) = (3)(7) − (−6)(2)\n    det(A) = 21 − (−12)\n    det(A) = 33\n\n📌 Singular and Invertible Matrices\n• If det(A) = 0, the matrix is singular — it has no inverse\n• If det(A) ≠ 0, the matrix is invertible — an inverse exists\n\n🔑 Inverse of a 2 × 2 Matrix\nFor A = [[a, b], [c, d]] with det(A) ≠ 0:\n    A⁻¹ = (1 / det(A)) × [[d, −b], [−c, a]]\n\nCheck: AA⁻¹ = A⁻¹A = I\n\n💡 Worked Example — Finding an Inverse\nLet A = [[4, 1], [3, 2]]\n\n  Step 1: Calculate the determinant\n    det(A) = (4)(2) − (1)(3) = 8 − 3 = 5\n\n  Step 2: Apply the inverse formula\n    A⁻¹ = (1/5) × [[2, −1], [−3, 4]]\n    A⁻¹ = [[2/5, −1/5], [−3/5, 4/5]]\n\n  Step 3: Verify by checking AA⁻¹ = I\n    Top-left:  (4)(2/5) + (1)(−3/5) = 8/5 − 3/5 = 1\n    Top-right: (4)(−1/5) + (1)(4/5) = −4/5 + 4/5 = 0\n    Bottom-left: (3)(2/5) + (2)(−3/5) = 6/5 − 6/5 = 0\n    Bottom-right: (3)(−1/5) + (2)(4/5) = −3/5 + 8/5 = 1\n    AA⁻¹ = [[1, 0], [0, 1]] = I  ✓\n\n🔑 Determinant Properties\n• det(I) = 1\n• det(O) = 0\n• det(AB) = det(A) × det(B)\n• det(kA) = k² × det(A)   for a 2 × 2 matrix\n\n💡 Worked Example — Using Determinant Properties\nIf A is a 2 × 2 matrix with det(A) = 4, find det(3A).\n\n  Step 1: Apply the scalar multiple property\n    det(3A) = 3² × det(A)\n    det(3A) = 9 × 4 = 36\n\n📎 Key Points to Remember\n• You only need to find 2 × 2 determinants and inverses by hand\n• For larger matrices, use your GDC\n• The inverse formula swaps the diagonal elements and negates the off-diagonal elements, then divides by the determinant\n• A matrix with determinant zero cannot be inverted\n\n⚠️ Common Mistake\nForgetting to divide by the determinant when finding the inverse. The formula is A⁻¹ = (1/det) × [[d, −b], [−c, a]], not just [[d, −b], [−c, a]]. Also, be careful with signs: det([[a, b], [c, d]]) = ad − bc, not ad + bc.',
    },
    {
      id: 'math-dp-matrices-n4',
      heading: 'Solving Systems of Linear Equations',
      body: 'One of the most powerful applications of matrices is solving systems of linear equations. Instead of solving equation by equation, you can solve the entire system in one step using matrix inverses.\n\n📌 Matrix Form of a System\nA system of linear equations can be written as:\n    AX = B\nwhere:\n• A = coefficient matrix\n• X = column vector of variables\n• B = column vector of constants\n\n🔑 Condition for a Unique Solution\nFor a unique solution to exist:\n• A must be square\n• det(A) ≠ 0  (A must be invertible)\n\nIf det(A) = 0, the system has either no solution or infinitely many solutions.\n\n💡 Worked Example — Solving a 2 × 2 System\nSolve:  2x + y = 7\n        3x + 2y = 12\n\n  Step 1: Write in matrix form AX = B\n    A = [[2, 1], [3, 2]],   X = [[x], [y]],   B = [[7], [12]]\n\n  Step 2: Find det(A)\n    det(A) = (2)(2) − (1)(3) = 4 − 3 = 1\n\n  Step 3: Find A⁻¹\n    A⁻¹ = (1/1) × [[2, −1], [−3, 2]]\n    A⁻¹ = [[2, −1], [−3, 2]]\n\n  Step 4: Solve X = A⁻¹B\n    X = [[2, −1], [−3, 2]] × [[7], [12]]\n    x = (2)(7) + (−1)(12) = 14 − 12 = 2\n    y = (−3)(7) + (2)(12) = −21 + 24 = 3\n\n  Step 5: Verify by substitution\n    2(2) + 3 = 7  ✓\n    3(2) + 2(3) = 12  ✓\n\n💡 Worked Example — Solving a 3 × 3 System\nSolve:  x + 3y − z = 3\n        2x + 2y + z = 2\n        3x − y + 2z = 1\n\n  Step 1: Write in matrix form AX = B\n    A = [[1, 3, −1], [2, 2, 1], [3, −1, 2]]\n    X = [[x], [y], [z]]\n    B = [[3], [2], [1]]\n\n  Step 2: Find A⁻¹ using your GDC\n    (In exams, use your GDC for 3 × 3 inverses)\n\n  Step 3: Calculate X = A⁻¹B\n    X = [[−5/8], [11/8], [5/4]]\n\n  Step 4: State the solution\n    x = −5/8,  y = 11/8,  z = 5/4\n\n📌 Isolating Variables in Matrix Equations\nIf AB = C, pre-multiply by A⁻¹:\n    B = A⁻¹C\n\nIf BA = C, post-multiply by A⁻¹:\n    B = CA⁻¹\n\nThe order of multiplication matters because matrix multiplication is not commutative.\n\n📎 Key Points to Remember\n• For 2 × 2 systems, you can solve by hand using the inverse formula\n• For 3 × 3 systems, use your GDC to find A⁻¹\n• Always verify your answer by substituting back into the original equations\n• If det(A) = 0, there is no unique solution\n• Pre-multiplication and post-multiplication give different results\n\n⚠️ Common Mistake\nGetting the order of multiplication wrong when isolating a matrix. Remember: to cancel A from the left side of AB = C, you must pre-multiply both sides by A⁻¹ (A⁻¹ on the left). To cancel A from the right side of BA = C, you must post-multiply both sides by A⁻¹ (A⁻¹ on the right).',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-matrices-f1',
      term: 'Order of a matrix',
      definition: 'The number of rows × columns in a matrix.',
      example: 'A 3 × 2 matrix has 3 rows and 2 columns.',
    },
    {
      id: 'math-dp-matrices-f2',
      term: 'Identity matrix I',
      definition: 'A square matrix with 1s on the leading diagonal and 0s elsewhere.',
      example: 'The 2 × 2 identity is [[1, 0], [0, 1]].',
    },
    {
      id: 'math-dp-matrices-f3',
      term: 'Zero matrix O',
      definition: 'A matrix where every element is 0.',
      example: 'The 2 × 2 zero matrix is [[0, 0], [0, 0]].',
    },
    {
      id: 'math-dp-matrices-f4',
      term: 'Matrix multiplication condition',
      definition: 'To multiply AB, the number of columns in A must equal the number of rows in B.',
      example: 'A (2 × 3) × B (3 × 4) is possible and gives a 2 × 4 matrix.',
    },
    {
      id: 'math-dp-matrices-f5',
      term: 'Determinant of a 2 × 2 matrix',
      definition: 'For [[a, b], [c, d]], det = ad − bc.',
      example: 'det([[3, 2], [1, 4]]) = 3×4 − 2×1 = 10.',
    },
    {
      id: 'math-dp-matrices-f6',
      term: 'Inverse of a 2 × 2 matrix',
      definition: 'A⁻¹ = (1/det) × [[d, −b], [−c, a]], provided det ≠ 0.',
      example: 'If A = [[4, 1], [3, 2]], det = 5, so A⁻¹ = (1/5) × [[2, −1], [−3, 4]].',
    },
    {
      id: 'math-dp-matrices-f7',
      term: 'Singular matrix',
      definition: 'A square matrix with determinant 0; it has no inverse.',
      example: '[[2, 4], [1, 2]] has det = 0, so it is singular.',
    },
    {
      id: 'math-dp-matrices-f8',
      term: 'Solving AX = B',
      definition: 'If A is invertible, the unique solution is X = A⁻¹B.',
      example: 'For a system 2x + y = 5, x − 3y = 6, write as AX = B and compute X = A⁻¹B.',
    },
  ],
  questions: [
    {
      id: 'math-dp-matrices-q1',
      stem: 'What is the order of a matrix with 4 rows and 3 columns?',
      choices: ['3 × 4', '4 × 3', '12', '7'],
      correctIndex: 1,
      explanation: 'Order is rows × columns, so 4 × 3.',
    },
    {
      id: 'math-dp-matrices-q2',
      stem: 'Let A be a 2 × 3 matrix and B be a 3 × 4 matrix. What is the order of AB?',
      choices: ['2 × 4', '3 × 3', '2 × 3', 'Cannot be multiplied'],
      correctIndex: 0,
      explanation: 'Columns of A (3) = rows of B (3), so AB exists with order 2 × 4.',
    },
    {
      id: 'math-dp-matrices-q3',
      stem: 'Which property does matrix multiplication NOT generally have?',
      choices: ['Associativity', 'Distributivity', 'Commutativity', 'Identity law'],
      correctIndex: 2,
      explanation: 'Matrix multiplication is associative and distributive, but NOT commutative: AB ≠ BA in general.',
    },
    {
      id: 'math-dp-matrices-q4',
      stem: 'Find the determinant of [[5, 2], [3, 4]].',
      choices: ['14', '20', '26', '−2'],
      correctIndex: 0,
      explanation: 'det = (5)(4) − (2)(3) = 20 − 6 = 14.',
    },
    {
      id: 'math-dp-matrices-q5',
      stem: 'For which value of k is the matrix [[2, 6], [1, k]] singular?',
      choices: ['2', '3', '4', '6'],
      correctIndex: 1,
      explanation: 'Singular means det = 0: 2k − 6 = 0 → k = 3.',
    },
    {
      id: 'math-dp-matrices-q6',
      stem: 'If A is a 2 × 2 matrix with det(A) = 4, what is det(3A)?',
      choices: ['12', '36', '24', '4'],
      correctIndex: 1,
      explanation: 'For a 2 × 2 matrix, det(kA) = k² det(A). So det(3A) = 9 × 4 = 36.',
    },
    {
      id: 'math-dp-matrices-q7',
      stem: 'Find the inverse of [[2, 1], [5, 3]].',
      choices: ['[[3, −1], [−5, 2]]', '[[3, 1], [−5, 2]]', '[[3, −1], [5, −2]]', '[[−3, 1], [5, −2]]'],
      correctIndex: 0,
      explanation: 'det = 2×3 − 1×5 = 1. A⁻¹ = (1/1) × [[3, −1], [−5, 2]] = [[3, −1], [−5, 2]]. Swap leading diagonal, negate off-diagonal.',
    },
    {
      id: 'math-dp-matrices-q8',
      stem: 'Solve the system 2x + y = 7 and 3x + 2y = 12 using matrices. Find x.',
      choices: ['1', '2', '3', '4'],
      correctIndex: 1,
      explanation: 'Write as AX = B with A = [[2, 1], [3, 2]], B = [[7], [12]]. det(A) = 1, so A⁻¹ = [[2, −1], [−3, 2]]. Then X = A⁻¹B = [[2], [3]], giving x = 2, y = 3.',
    },
    {
      id: 'math-dp-matrices-q9',
      stem: 'If AB = C, which equation correctly isolates B?',
      choices: ['B = A⁻¹C', 'B = CA⁻¹', 'B = C⁻¹A', 'B = AC⁻¹'],
      correctIndex: 0,
      explanation: 'Pre-multiply both sides by A⁻¹: A⁻¹AB = A⁻¹C → IB = A⁻¹C → B = A⁻¹C.',
    },
    {
      id: 'math-dp-matrices-q10',
      stem: 'A system of three linear equations in three variables is written as AX = B. For a unique solution, what must be true?',
      choices: ['A must be a zero matrix', 'det(A) must equal 0', 'A must be square and det(A) ≠ 0', 'B must be the identity matrix'],
      correctIndex: 2,
      explanation: 'A unique solution requires A to be invertible, which means it must be square with a non-zero determinant.',
    },
  ],
};

export default mathDpMatrices;
