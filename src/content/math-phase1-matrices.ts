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
      body: 'A matrix is a rectangular array of numbers arranged in rows and columns. The order (or size) of a matrix with m rows and n columns is written as m × n. The element in row i and column j is denoted aᵢⱼ. Special matrices include: column matrices (one column), row matrices (one row), square matrices (m = n), zero matrices (all entries 0), and identity matrices I (square with 1s on the leading diagonal and 0s elsewhere). Two matrices are equal only when they have the same order and every corresponding element is identical. Matrices are powerful tools for organising data, representing transformations, and solving systems of equations.',
    },
    {
      id: 'math-dp-matrices-n2',
      heading: 'Operations with Matrices',
      body: 'Addition and subtraction: only possible for matrices of the same order — add or subtract corresponding elements. A + B = B + A (commutative) and (A + B) + C = A + (B + C) (associative). Scalar multiplication: multiply every element by the scalar k, so kA = (kaᵢⱼ). Matrix multiplication: the number of columns in the first matrix must equal the number of rows in the second. If A is m × n and B is n × p, then AB is m × p. The (i,j) entry of AB is the dot product of row i of A and column j of B. Matrix multiplication is NOT commutative (AB ≠ BA in general), but it is associative: A(BC) = (AB)C. Powers of square matrices: A² = AA, A³ = AAA, etc.',
    },
    {
      id: 'math-dp-matrices-n3',
      heading: 'Determinants and Inverses',
      body: 'The determinant is a number calculated from a square matrix. For a 2 × 2 matrix A = [[a, b], [c, d]], det(A) = ad − bc. Only square matrices have determinants. If det(A) = 0, the matrix is singular (no inverse exists). If det(A) ≠ 0, the matrix is invertible. The inverse of a 2 × 2 matrix is A⁻¹ = (1/det(A)) × [[d, −b], [−c, a]]. Check: AA⁻¹ = A⁻¹A = I. Key determinant properties: det(I) = 1, det(O) = 0, det(AB) = det(A) × det(B), and det(kA) = k² det(A) for a 2 × 2 matrix. For larger matrices, use your GDC to find determinants and inverses.',
    },
    {
      id: 'math-dp-matrices-n4',
      heading: 'Solving Systems of Linear Equations',
      body: 'A system of linear equations can be written in matrix form as AX = B, where A is the coefficient matrix, X is the column vector of variables, and B is the column vector of constants. For a unique solution, A must be square and invertible (det(A) ≠ 0). To solve: rewrite as X = A⁻¹B, then evaluate. For a 2 × 2 system you can find A⁻¹ by hand; for 3 × 3 systems use your GDC. This method is especially powerful for larger systems and word problems — translate each equation into rows of A, then solve in one step. Always verify your answer by substituting back into the original equations.',
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
