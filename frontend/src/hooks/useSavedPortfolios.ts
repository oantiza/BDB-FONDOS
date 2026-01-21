import { useState, useEffect } from 'react';
import { collection, query, addDoc, deleteDoc, doc, onSnapshot, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PortfolioItem } from '../types';
import { useToast } from '../context/ToastContext';

export interface SavedPortfolio {
    id: string;
    name: string;
    createdAt: any;
    items: PortfolioItem[];
    totalCapital: number;
}

export function useSavedPortfolios() {
    const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) {
            setSavedPortfolios([]);
            return;
        }

        const q = query(
            collection(db, `users/${user.uid}/saved_portfolios`),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            const portfolios = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SavedPortfolio[];
            setSavedPortfolios(portfolios);
        }, (error) => {
            console.error("Error listening to portfolios:", error);
            // toast.error("Error cargando carteras guardadas");
        });

        return () => unsubscribeSnapshot();
    }, [user]);

    const savePortfolio = async (name: string, items: PortfolioItem[], totalCapital: number) => {
        if (!user) {
            toast.error("Debes iniciar sesión para guardar carteras");
            return false;
        }

        if (savedPortfolios.length >= 10) {
            toast.error("Has alcanzado el límite de 10 carteras guardadas");
            return false;
        }

        if (!name.trim()) {
            toast.error("El nombre de la cartera es obligatorio");
            return false;
        }

        try {
            setLoading(true);
            await addDoc(collection(db, `users/${user.uid}/saved_portfolios`), {
                name,
                items,
                totalCapital,
                createdAt: serverTimestamp()
            });
            toast.success("Cartera guardada correctamente");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar la cartera");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deletePortfolio = async (id: string) => {
        if (!user) return;
        if (!window.confirm("¿Estás seguro de eliminar esta cartera guardada?")) return;

        try {
            setLoading(true);
            await deleteDoc(doc(db, `users/${user.uid}/saved_portfolios`, id));
            toast.success("Cartera eliminada");
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
        } finally {
            setLoading(false);
        }
    };

    return {
        savedPortfolios,
        savePortfolio,
        deletePortfolio,
        loading,
        isAuthenticated: !!user
    };
}
