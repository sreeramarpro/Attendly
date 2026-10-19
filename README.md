# Attendly — Intelligent ERP Attendance Calculator

**Attendly** is an intelligent, highly flexible attendance calculator built to understand attendance information written in ordinary English, copied from college ERP tables, manually typed in shorthand, or provided in any mixture of formats.

The user adapts to the application as little as possible—the application does the heavy lifting of interpreting, organizing, and calculating accurate weighted attendance percentages.

---

## Key Features

- **No Special Formatting Required**: Paste directly from ERP web portals, copy from PDFs, type in natural English, or write quick shorthand (`L 26 28 P 16 24`).
- **100% Local & Private**: All normalization, parsing, validation, and calculations execute entirely in the user's browser. No backend server, no database, no API keys, and no user tracking.
- **Academic Component Weighting**: Supports distinct weights for Lecture (L), Tutorial (T), Practical/Lab (P), and Skill (S) components.
- **Two Calculation Modes**:
  - **Raw-Count Weighted Method (Default)**: `(Σ Attended × Weight) ÷ (Σ Conducted × Weight) × 100`
  - **ERP-Percentage Method**: `Σ (Percentage × Weight) ÷ Σ (Weight)`
- **Target Attendance Analysis**: Set your target attendance threshold (e.g., 75% or 85%) to calculate how many classes you can safely miss or how many consecutive classes you must attend to reach your goal.
- **Safe Subject Merging & Duplicate Detection**: Merges identical course codes and subject names automatically, detects conflicting counts for the same component, and suggests merges for abbreviations (e.g., "ASE" and "Adaptive Software Engineering") with user confirmation.
- **Incomplete & Ambiguous Data Handling**: Ambiguous or partial entries are flagged with clear suggestions and editable fields; valid subjects calculate independently without being blocked.
- **Interactive Review & Editing**: Edit subject names, course codes, components, counts, and weights with live recalculation previews.
- **Export & Sharing**: One-click text summary copy, Tab-Separated Values (TSV) for pasting straight into Microsoft Excel or Google Sheets, and standard CSV file download.
- **Keyboard Shortcuts**: `Ctrl + Enter` (or `Cmd + Enter`) to calculate attendance instantly.

---

## Technology Stack

- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Lucide Icons**
- **Vitest** for automated unit and integration tests

---

## Installation & Local Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### 1. Clone or Open the Repository

```bash
cd attendancecalc
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Visit the local development URL shown in your terminal (typically `http://localhost:5173`).

### 4. Build for Production

```bash
npm run build
```

The compiled, minified bundle will be generated in the `dist/` directory.

### 5. Preview Production Build

```bash
npm run preview
```

---

## Running the Automated Test Suite

Attendly includes comprehensive automated tests covering all 23 core scenarios specified in the master specification, plus edge-case tests:

```bash
npm test
```

To run Vitest in interactive watch mode:

```bash
npm run test:watch
```

---

## Default Component Weights

Standard university weighting defaults:

| Component Type | Letter | Default Weight | Description |
| :--- | :---: | :---: | :--- |
| **Lecture** | `L` | **1.0** | Main theory / classroom sessions |
| **Tutorial** | `T` | **1.0** | Problem-solving / discussion sessions |
| **Practical / Lab** | `P` | **0.5** | Laboratory / hands-on practicals |
| **Skill Class** | `S` | **0.25** | Specialized soft skills / practical modules |
| **General** | - | **1.0** | Unspecified class sessions |

> **Note**: Users can customize these weights anytime via the **Settings** modal, persist them locally across sessions in `localStorage`, or reset them to defaults with one click.

---

## Calculation Formulas

### 1. Raw-Count Weighted Attendance (Default)

When attended and conducted counts are available:

$$\text{Overall Attendance (\%)} = \frac{\sum (\text{Attended}_i \times \text{Weight}_i)}{\sum (\text{Conducted}_i \times \text{Weight}_i)} \times 100$$

#### Worked Example 1
- **Lecture**: 26 attended out of 28, weight 1.0 $\rightarrow 26 \times 1.0 = 26$
- **Practical**: 16 attended out of 24, weight 0.5 $\rightarrow 16 \times 0.5 = 8$
- **Weighted Attended** = $26 + 8 = 34$
- **Weighted Conducted** = $28 + (24 \times 0.5) = 40$
- **Overall Attendance** = $\frac{34}{40} \times 100 = \mathbf{85.00\%}$

#### Worked Example 2
- **Lecture**: 18/20, weight 1.0 $\rightarrow$ Attended = 18, Conducted = 20
- **Practical**: 16/22, weight 0.5 $\rightarrow$ Attended = 8, Conducted = 11
- **Weighted Attended** = $18 + 8 = 26$
- **Weighted Conducted** = $20 + 11 = 31$
- **Overall Attendance** = $\frac{26}{31} \times 100 = \mathbf{83.87\%}$

---

### 2. ERP-Percentage Weighted Method

When configured or requested:

$$\text{Overall Attendance (\%)} = \frac{\sum (\text{Component Percentage}_i \times \text{Weight}_i)}{\sum \text{Weight}_i}$$

---

### 3. Target Attendance Analysis

Given target percentage $T$ (e.g. 75% or 0.75):

- **If current percentage $\ge T$ (Classes you can safely miss / bunk):**
  $$\text{Classes You Can Miss} = \left\lfloor \frac{\text{Attended} - (T \times \text{Conducted})}{T} \right\rfloor$$

- **If current percentage $< T$ (Classes you must attend):**
  $$\text{Classes Needed} = \left\lceil \frac{(T \times \text{Conducted}) - \text{Attended}}{1 - T} \right\rceil$$

---

## Supported Input Formats

Attendly recognizes an arbitrary variety of formats without requiring a predefined structure:

1. **ERP Tabular Data**: Direct copy-paste from student portals. Automatically identifies column headings (`Course Code`, `Course Title`, `Type`, `Held`, `Attended`, `Absent`, `%`), regardless of column order, table borders, tabs, or whitespace alignment.
2. **Natural English Sentences**:
   - `"ASE lecture 26 attended out of 28 and practical 16 out of 24."`
   - `"For Adaptive Software Engineering, I attended 26 of 28 lectures. Missed 2 classes."`
   - `"Data science I went to 31 classes out of 36 lectures, practicals 16 out of 22."`
   - `"conducted 28, absent 2 in Computer Networks lecture"`
   - `"All 25 lectures attended in Database Systems."`
3. **Compact Shorthand**:
   - `"ASE L 26 28 P 16 24, PDC L 18 20 P 16 22"`
   - `"DL lecture 31/34 and practical 12/24, SOA theory 11/11 skill 26/46"`
4. **Mixed Inputs**: Paragraphs containing combinations of course codes, tables, sentences, and shorthand notes.

---

## How Ambiguous Values are Handled

- **Bare Numbers**: An input such as `"ASE 26 28"` lacks explicit component labels or ratio indicators. Rather than blindly guessing, Attendly records the counts with an `'ambiguous_values'` warning and invites the user to confirm attended vs. total counts in the edit panel.
- **Attended Exceeding Conducted**: Inputs like `"28 attended out of 26"` produce an `'attended_exceeds_conducted'` warning with suggested count correction.
- **Conflicting Duplicate Records**: If the same subject and component appear twice with differing counts (e.g., Lecture 26/28 vs. 18/20), Attendly flags a `'contradicting_records'` warning.
- **Incomplete Records**: Subjects with missing attendance numbers are listed as incomplete, allowing users to enter the details while all valid subjects calculate normally.

---

## Known Limitations of Local Natural-Language Interpretation

- **Ambiguous Numerical Context**: Bare numbers without labels (e.g. `Subject 12 15`) cannot be definitively mapped to attended and conducted without context. Attendly flags these for user verification.
- **Non-Standard Multi-Year Aggregate Headers**: Highly idiosyncratic tables where column headers span multiple irregular rows without recognizable labels may require users to review the mapped fields in the review panel.
- **Overlapping Homographs**: Subject names that consist entirely of common English prepositions or component words (e.g. a hypothetical course named "Theory And Practice") may require explicit punctuation or course codes to avoid ambiguity.

---

## License

MIT License. Built with ❤️ for students and educators everywhere.
