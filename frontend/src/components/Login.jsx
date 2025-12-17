export default function Login({ onLogin }) {
    return (
        <div className="fixed inset-0 z-[100] bg-brand flex items-center justify-center p-4">
            <div className="bg-white w-96 p-8 rounded shadow-2xl border-t-4 border-accent">
                <h2 className="text-3xl font-bold text-center mb-6 font-serif text-brand">Nexus Terminal</h2>
                <input
                    type="email"
                    className="w-full border-b-2 p-3 mb-3 outline-none focus:border-accent"
                    placeholder="Usuario"
                    defaultValue="demo@nexus.com"
                />
                <input
                    type="password"
                    className="w-full border-b-2 p-3 mb-6 outline-none focus:border-accent"
                    placeholder="Clave"
                    defaultValue="demo123"
                />
                <button
                    onClick={onLogin}
                    className="w-full bg-brand text-white py-3 font-bold hover:bg-[#153e6e] transition-colors"
                >
                    ENTRAR
                </button>
            </div>
        </div>
    )
}
