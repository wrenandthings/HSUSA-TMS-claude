import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parseCsv, parseQuestionBankCsv } = require("../../electron/main/question-bank.js");
const banks = path.resolve(__dirname, "../../documents/question-banks");

const HEADER = "questionId,questionText,answerA,answerB,answerC,answerD,correctAnswer,answer,reference,category,subject,section,difficulty,sourceRevision,active";
const good = 'Q-1,What is 2+2?,3,4,5,6,B,4,"OM-A 1.1, p. 2",Basics,MAINT,1.1,,OM-A V2,Yes';

describe("question-bank CSV parsing", () => {
    it("handles quotes, doubled quotes, commas and line breaks inside quotes, and CRLF", () => {
        expect(parseCsv('a,"b, c","say ""hi""","line\r\nbreak"\r\nx,y,z,w\r\n')).toEqual([
            ["a", "b, c", 'say "hi"', "line\r\nbreak"],
            ["x", "y", "z", "w"]
        ]);
    });

    it("reads a good row with the agreed columns", () => {
        const { rows, errors } = parseQuestionBankCsv(`﻿${HEADER}\n${good}\n`);
        expect(errors).toEqual([]);
        expect(rows[0]).toMatchObject({ externalId: "Q-1", correctAnswer: "B", reference: "OM-A 1.1, p. 2", difficulty: null, active: true, subject: "MAINT" });
    });

    it("accepts the IMP-QBANK-001 header names", () => {
        const header = "QuestionId,Question,AnswerA,AnswerB,AnswerC,AnswerD,CorrectAnswer,Reference,Subject,Active";
        const { rows, errors } = parseQuestionBankCsv(`${header}\nQ-2,Pick one,a,b,c,d,d,Ref,MAINT,false\n`);
        expect(errors).toEqual([]);
        expect(rows[0]).toMatchObject({ questionText: "Pick one", correctAnswer: "D", active: false });
    });

    it("names every problem with its row, and imports none of a bad row", () => {
        const csv = [HEADER,
            "Q-1,Text,a,b,c,d,E,,Ref,,MAINT,,,,Yes",
            "Q-2,Text,a,b,c,d,A,b,Ref,,MAINT,,,,Yes",
            "Q-3,Text,a,b,c,d,A,a,,,MAINT,,,,Maybe",
            "Q-3,Text,a,b,c,d,A,a,Ref,,MAINT,,,,Yes"
        ].join("\n");
        const { rows, errors } = parseQuestionBankCsv(csv);
        expect(rows).toEqual([]);
        expect(errors).toEqual([
            'Row 2 (Q-1): correctAnswer must be A, B, C or D (found "E").',
            "Row 3 (Q-2): answer does not match answerA.",
            'Row 4 (Q-3): reference is empty; active must be Yes or No (found "Maybe").',
            "Row 5 (Q-3): questionId Q-3 is also on row 4."
        ]);
    });

    it("says which columns are missing", () => {
        expect(parseQuestionBankCsv("questionId,questionText\nQ,T\n").errors[0]).toBe(
            "The file is missing these columns: answerA, answerB, answerC, answerD, correctAnswer, reference, subject."
        );
    });

    it("reads both of Quail's banks with no problems", () => {
        const maint = parseQuestionBankCsv(readFileSync(path.join(banks, "Maint_question_bank.csv"), "utf8"));
        const ampi = parseQuestionBankCsv(readFileSync(path.join(banks, "Maint_AMP_AMPI_question_bank.csv"), "utf8"));
        expect(maint.errors).toEqual([]);
        expect(ampi.errors).toEqual([]);
        expect(maint.rows).toHaveLength(704);
        expect(ampi.rows).toHaveLength(504);
    });
});
