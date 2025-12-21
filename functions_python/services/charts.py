
import matplotlib
matplotlib.use('Agg') # Headless mode for Cloud Functions
import matplotlib.pyplot as plt
import io

# Brand Colors
COLOR_NAVY = '#0B2545'
COLOR_GOLD = '#D4AF37'
COLOR_GRAY = '#E5E7EB'
COLOR_RED = '#EF4444'
COLOR_GREEN = '#10B981'

def generate_asset_allocation_chart(data):
    """
    Generates a high-quality donut chart for asset allocation views.
    Returns: BytesIO object containing the PNG.
    """
    if not data:
        return None
    
    # Process data to count views (Overweight/Neutral/Underweight)
    counts = {'SOBREPONDERAR': 0, 'NEUTRAL': 0, 'INFRAPONDERAR': 0}
    
    labels = []
    sizes = []
    colors = []
    
    # Map input views to standard Spanish keys
    view_map = {
        'OVERWEIGHT': 'SOBREPONDERAR', 
        'UNDERWEIGHT': 'INFRAPONDERAR',
        'Neutral': 'NEUTRAL',
        'SOBREPONDERAR': 'SOBREPONDERAR',
        'INFRAPONDERAR': 'INFRAPONDERAR',
        'NEUTRAL': 'NEUTRAL'
    }
    
    for item in data:
        raw_view = item.get('view', 'NEUTRAL')
        view = view_map.get(raw_view, 'NEUTRAL')
        counts[view] += 1

    # Prepare data for chart
    # We want to show the distribution of our Tactical Views
    chart_labels = []
    chart_sizes = []
    chart_colors = []
    
    if counts['SOBREPONDERAR'] > 0:
        chart_labels.append(f"Sobreponderar\n({counts['SOBREPONDERAR']})")
        chart_sizes.append(counts['SOBREPONDERAR'])
        chart_colors.append(COLOR_GREEN)
        
    if counts['NEUTRAL'] > 0:
        chart_labels.append(f"Neutral\n({counts['NEUTRAL']})")
        chart_sizes.append(counts['NEUTRAL'])
        chart_colors.append(COLOR_GRAY)
        
    if counts['INFRAPONDERAR'] > 0:
        chart_labels.append(f"Infraponderar\n({counts['INFRAPONDERAR']})")
        chart_sizes.append(counts['INFRAPONDERAR'])
        chart_colors.append(COLOR_RED)

    if not chart_sizes:
        return None

    # Create Plot
    fig, ax = plt.subplots(figsize=(6, 4))
    
    # Donut Chart
    wedges, texts, autotexts = ax.pie(chart_sizes, labels=chart_labels, colors=chart_colors, 
                                      autopct='%1.1f%%', startangle=90, pctdistance=0.85,
                                      textprops=dict(color="black", fontsize=9, fontweight='bold'))
    
    # Draw circle for Donut
    centre_circle = plt.Circle((0,0),0.70,fc='white')
    fig.gca().add_artist(centre_circle)
    
    # Add Title in Center
    ax.text(0, 0, 'Visión\nTáctica', horizontalalignment='center', verticalalignment='center', 
            fontsize=12, fontweight='bold', color=COLOR_NAVY)
    
    ax.axis('equal')  
    plt.tight_layout()
    
    # Save to buffer
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    
    return buf
