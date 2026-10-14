# Phase 2a - Graph Specifications

These specifications describe the graphs for the **Graphs** worksheet of the Phase 2a spreadsheet. Each graph gets its data from the **Analysis** worksheet (the content of `Analysis_Worksheet.csv`), which in turn counts the answers on the **Data** worksheet (the content of `Questionnaire_Responses.csv`).

## Workbook layout

| Worksheet | Content |
|---|---|
| Data | The questionnaire responses from `Questionnaire_Responses.csv`: headings in row 1 and respondents 1 to 10 in rows 2 to 11. |
| Analysis | The formulas and functions from `Analysis_Worksheet.csv`, with the Count and Percentage columns for each question. |
| Graphs | The three graphs described below, each placed on this worksheet and not next to the data. |

## General rules for every graph

- Give the graph a clear title that says what it shows.
- Label both axes (or give the legend for a pie chart) so the graph can be understood without the data.
- Show the data labels (the number of respondents) on the bars or slices.
- Use a readable font size (at least 10 pt for labels and 14 pt for the title).
- Use clearly different colours for each bar or slice, and keep the colours consistent with the presentation.
- Place each graph so that it does not overlap another graph, and leave enough space so that all text is readable.
- Do not use a 3-D effect, because it makes the values harder to compare.

---

## Graph 1: Most effective technology against climate change

| Property | Specification |
|---|---|
| Question | Q5. Which technology is the most effective against climate change? |
| Chart type | Clustered column chart (a bar chart is also acceptable) |
| Category labels (x-axis) | `Analysis!$A$38:$A$42` (Solar and wind power, Electric vehicles, Smart farming, Recycling technologies, Eco-friendly apps) |
| Values (y-axis) | `Analysis!$B$38:$B$42` (Count) |
| Title | Which Technology Do Learners Think Is Most Effective Against Climate Change? |
| X-axis title | Technology |
| Y-axis title | Number of learners |
| Y-axis scale | Minimum 0, maximum 10, major unit 1 (the sample is ten learners) |
| Legend | None (a single series), but show data labels |
| Why it is useful | It answers the second part of the focus question and can be compared with the initial conclusion in the Phase 1 research planning document. |

---

## Graph 2: Eco-friendly technologies used in learners' households

| Property | Specification |
|---|---|
| Question | Q7. Which eco-friendly technologies does your household use? |
| Chart type | Clustered bar chart (horizontal bars, because the category names are long) |
| Category labels | `Analysis!$A$55:$A$59` (Solar panels or a solar geyser, Recycling bins or recycling services, An eco-friendly app, An electric or hybrid vehicle, None of these) |
| Values | `Analysis!$B$55:$B$59` (Households using it) |
| Title | Eco-Friendly Technologies Used in Learners' Households |
| X-axis title (value axis) | Number of households |
| Y-axis title (category axis) | Technology |
| Value axis scale | Minimum 0, maximum 10, major unit 1 |
| Legend | None (a single series), but show data labels |
| Why it is useful | It shows which technologies people already use at home, which supports the findings about solar power, recycling, apps and electric vehicles. |

---

## Graph 3: Can technology help to reduce the effects of climate change?

| Property | Specification |
|---|---|
| Question | Q4. Can technology help to reduce the effects of climate change? |
| Chart type | Pie chart |
| Category labels | `Analysis!$A$30:$A$33` (Yes, a lot; Yes, a little; No; I am not sure) |
| Values | `Analysis!$B$30:$B$33` (Count) |
| Title | Learners' Opinions on Whether Technology Can Reduce the Effects of Climate Change |
| Legend | Show at the right or bottom, listing all four answers |
| Data labels | Show the percentage and the category name on each slice |
| Why it is useful | It shows the share of learners who believe technology helps, which is the main opinion tested by the questionnaire. |

---

## Checks before the graphs are used in the presentation

1. Confirm that every graph has a title and labelled axes (or a legend for the pie chart).
2. Confirm that each graph is readable when pasted onto a slide, without text that is too small to read.
3. Confirm that the values on the graphs match the Count column on the Analysis worksheet.
4. Save a copy of each graph as a picture so that it can be inserted in the final presentation.