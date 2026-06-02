import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AuthPanel({ user, setUser }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function signUp() {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }

        alert("נשלחה הודעת אישור למייל, אם נדרש אישור במערכת.");
    }

    async function signIn() {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }

        setUser(data.user);
    }

    async function signOut() {
        await supabase.auth.signOut();
        setUser(null);
    }

    if (user) {
        return (
            <div className="auth-panel">
                <span>מחובר: {user.email}</span>

                <button className="mini-button" onClick={signOut}>
                    התנתק
                </button>
            </div>
        );
    }

    return (
        <div className="auth-panel">
            <input
                type="email"
                placeholder="אימייל"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button className="mini-button" onClick={signIn}>
                התחבר
            </button>

            <button className="mini-button" onClick={signUp}>
                הרשמה
            </button>
        </div>
    );
}