/**
 * End-to-end test — Login / Register screen
 *
 * Renders the full component tree (LoginRegisterScreen → InputField →
 * SubmitFormButton → ForgotPasswordButton) and drives it through real user
 * interactions. Only the external service boundaries (Firebase, SQLite) are
 * mocked — all application code runs as-is.
 */

import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";
import React from "react";

import LoginRegisterScreen from "@/app/screens/LoginRegisterScreen";

// ─── External boundary mocks ──────────────────────────────────────────────────

jest.mock("firebase/app", () => ({
    initializeApp: jest.fn(() => ({})),
    FirebaseError: class FirebaseError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
            this.name = "FirebaseError";
        }
    },
}));

jest.mock("firebase/auth", () => ({
    getAuth: jest.fn(() => ({})),
    createUserWithEmailAndPassword: jest.fn(),
    updateProfile: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
    getFirestore: jest.fn(() => ({})),
    doc: jest.fn(() => "mock-doc-ref"),
    setDoc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
}));

jest.mock("firebase/storage", () => ({
    getStorage: jest.fn(() => ({})),
}));

jest.mock("@/lib/db/database", () => ({
    sqliteDb: {
        execSync: jest.fn(),
        runAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue(null),
    },
}));

// Vector icons render nothing in tests — avoids native font loading
jest.mock("@expo/vector-icons", () => ({
    Ionicons: () => null,
}));

// ─── Firebase mock handles ─────────────────────────────────────────────────

import { FirebaseError } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";
import { setDoc } from "firebase/firestore";

const mockedCreateUser = jest.mocked(createUserWithEmailAndPassword);
const mockedSignIn = jest.mocked(signInWithEmailAndPassword);
const mockedUpdate = jest.mocked(updateProfile);
const mockedSetDoc = jest.mocked(setDoc);

const FAKE_UID = "e2e-uid-999";
const FAKE_USER = { uid: FAKE_UID, displayName: null, email: "jane@test.com" };

beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateUser.mockResolvedValue({ user: FAKE_USER } as any);
    mockedUpdate.mockResolvedValue(undefined);
    mockedSetDoc.mockResolvedValue(undefined);
    mockedSignIn.mockResolvedValue({ user: FAKE_USER } as any);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderScreen(onStartRegister = jest.fn()) {
    return render(<LoginRegisterScreen onStartRegister={onStartRegister} />);
}

async function switchToRegister() {
    fireEvent.press(screen.getByText("Register"));
}

// ─── Sign-in flow ─────────────────────────────────────────────────────────────

describe("Sign-in flow", () => {
    it("renders the Sign In tab by default", () => {
        renderScreen();
        expect(screen.getByText("Sign In")).toBeTruthy();
        expect(screen.getByPlaceholderText("janedoe@example.com")).toBeTruthy();
        expect(screen.getByPlaceholderText("Enter your password")).toBeTruthy();
    });

    it("calls Firebase signIn with the entered credentials", async () => {
        renderScreen();

        fireEvent.changeText(
            screen.getByPlaceholderText("janedoe@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Enter your password"),
            "secret123",
        );
        fireEvent.press(screen.getByText("Sign In"));

        await waitFor(() => {
            expect(mockedSignIn).toHaveBeenCalledWith(
                expect.anything(),
                "jane@test.com",
                "secret123",
            );
        });
    });

    it("shows a validation error when fields are empty", async () => {
        renderScreen();

        fireEvent.press(screen.getByText("Sign In"));

        await waitFor(() => {
            expect(screen.getByText("Please fill in all fields.")).toBeTruthy();
        });
        expect(mockedSignIn).not.toHaveBeenCalled();
    });

    it("displays the correct error message when Firebase rejects the login", async () => {
        mockedSignIn.mockRejectedValueOnce(
            new FirebaseError("auth/invalid-credential", "Bad credentials"),
        );
        renderScreen();

        fireEvent.changeText(
            screen.getByPlaceholderText("janedoe@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Enter your password"),
            "wrongpassword",
        );
        fireEvent.press(screen.getByText("Sign In"));

        await waitFor(() => {
            expect(
                screen.getByText("Incorrect email or password."),
            ).toBeTruthy();
        });
    });

    it("dismisses the error banner when the × button is pressed", async () => {
        mockedSignIn.mockRejectedValueOnce(
            new FirebaseError("auth/invalid-credential", "Bad credentials"),
        );
        renderScreen();

        fireEvent.changeText(
            screen.getByPlaceholderText("janedoe@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Enter your password"),
            "wrong",
        );
        fireEvent.press(screen.getByText("Sign In"));

        await waitFor(() => {
            expect(
                screen.getByText("Incorrect email or password."),
            ).toBeTruthy();
        });

        fireEvent.press(screen.getByText("×"));

        expect(screen.queryByText("Incorrect email or password.")).toBeNull();
    });
});

// ─── Register flow ────────────────────────────────────────────────────────────

describe("Register flow", () => {
    it("shows the registration form after switching tabs", async () => {
        renderScreen();
        await switchToRegister();

        expect(screen.getByPlaceholderText("Jane Smith")).toBeTruthy();
        expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
        expect(screen.getByPlaceholderText("Create a password")).toBeTruthy();
        expect(screen.getByPlaceholderText("Repeat password")).toBeTruthy();
    });

    it("completes full registration and calls Firebase Auth + Firestore", async () => {
        const onStartRegister = jest.fn();
        renderScreen(onStartRegister);
        await switchToRegister();

        fireEvent.changeText(
            screen.getByPlaceholderText("Jane Smith"),
            "Jane Smith",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("you@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Create a password"),
            "secret123",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Repeat password"),
            "secret123",
        );

        fireEvent.press(screen.getByText("Create Account"));

        await waitFor(() => {
            // Firebase Auth called
            expect(mockedCreateUser).toHaveBeenCalledWith(
                expect.anything(),
                "jane@test.com",
                "secret123",
            );
            // Display name set
            expect(mockedUpdate).toHaveBeenCalledWith(FAKE_USER, {
                displayName: "Jane Smith",
            });
            // Firestore profile created
            expect(mockedSetDoc).toHaveBeenCalledTimes(1);
            // onStartRegister signalled before auth
            expect(onStartRegister).toHaveBeenCalled();
        });
    });

    it("shows a validation error when any field is empty", async () => {
        renderScreen();
        await switchToRegister();

        // Leave all fields empty
        fireEvent.press(screen.getByText("Create Account"));

        await waitFor(() => {
            expect(screen.getByText("Please fill in all fields.")).toBeTruthy();
        });
        expect(mockedCreateUser).not.toHaveBeenCalled();
    });

    it("shows an error when passwords do not match", async () => {
        renderScreen();
        await switchToRegister();

        fireEvent.changeText(screen.getByPlaceholderText("Jane Smith"), "Jane");
        fireEvent.changeText(
            screen.getByPlaceholderText("you@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Create a password"),
            "secret123",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Repeat password"),
            "different",
        );

        fireEvent.press(screen.getByText("Create Account"));

        await waitFor(() => {
            expect(screen.getByText("Passwords do not match.")).toBeTruthy();
        });
        expect(mockedCreateUser).not.toHaveBeenCalled();
    });

    it("shows an error when password is too short", async () => {
        renderScreen();
        await switchToRegister();

        fireEvent.changeText(screen.getByPlaceholderText("Jane Smith"), "Jane");
        fireEvent.changeText(
            screen.getByPlaceholderText("you@example.com"),
            "jane@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Create a password"),
            "abc",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Repeat password"),
            "abc",
        );

        fireEvent.press(screen.getByText("Create Account"));

        await waitFor(() => {
            expect(
                screen.getByText("Password must be at least 6 characters."),
            ).toBeTruthy();
        });
        expect(mockedCreateUser).not.toHaveBeenCalled();
    });

    it("shows a Firebase error when the email is already in use", async () => {
        mockedCreateUser.mockRejectedValueOnce(
            new FirebaseError("auth/email-already-in-use", "Taken"),
        );
        renderScreen();
        await switchToRegister();

        fireEvent.changeText(screen.getByPlaceholderText("Jane Smith"), "Jane");
        fireEvent.changeText(
            screen.getByPlaceholderText("you@example.com"),
            "taken@test.com",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Create a password"),
            "secret123",
        );
        fireEvent.changeText(
            screen.getByPlaceholderText("Repeat password"),
            "secret123",
        );

        fireEvent.press(screen.getByText("Create Account"));

        await waitFor(() => {
            expect(
                screen.getByText("An account with this email already exists."),
            ).toBeTruthy();
        });
    });

    it("clears errors when switching between tabs", async () => {
        renderScreen();

        // Trigger a validation error on the login tab
        fireEvent.press(screen.getByText("Sign In"));
        await waitFor(() =>
            expect(screen.getByText("Please fill in all fields.")).toBeTruthy(),
        );

        // Switching to Register should clear the error
        await switchToRegister();
        expect(screen.queryByText("Please fill in all fields.")).toBeNull();
    });
});
