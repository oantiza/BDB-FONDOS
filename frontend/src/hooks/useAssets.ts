import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { normalizeFundData } from '../utils/normalizer'

export function useAssets(isAuthenticated: boolean) {
    const [assets, setAssets] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null)
    const [error, setError] = useState<string | null>(null)

    const FUNDS_PER_PAGE = 50

    const loadMore = useCallback(async (isInitial = false) => {
        if (!isAuthenticated) return
        if (loading) return
        if (!isInitial && !hasMore) return

        setLoading(true)
        setError(null)

        try {
            const fundsRef = collection(db, 'funds_v2')

            let q = query(fundsRef, orderBy('name'), limit(FUNDS_PER_PAGE))

            if (!isInitial && lastDoc) {
                q = query(fundsRef, orderBy('name'), startAfter(lastDoc), limit(FUNDS_PER_PAGE))
            }

            const snapshot = await getDocs(q)

            if (snapshot.empty) {
                setHasMore(false)
                setLoading(false)
                return
            }

            const newLastDoc = snapshot.docs[snapshot.docs.length - 1]
            setLastDoc(newLastDoc)

            const newAssets: any[] = []
            snapshot.forEach(doc => {
                newAssets.push(normalizeFundData({ isin: doc.id, ...doc.data() }))
            })

            setAssets(prev => isInitial ? newAssets : [...prev, ...newAssets])

            if (snapshot.size < FUNDS_PER_PAGE) {
                setHasMore(false)
            }

        } catch (err: any) {
            console.error("Error loading assets:", err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [isAuthenticated, lastDoc, loading, hasMore])

    // Initial Load
    useEffect(() => {
        if (isAuthenticated && assets.length === 0) {
            loadMore(true)
        }
    }, [isAuthenticated]) // Only run on auth change or first mount logic

    return {
        assets,
        loading,
        hasMore,
        error,
        loadMore
    }
}
