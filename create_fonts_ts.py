with open('roboto_flex_b64.txt', 'r') as f:
    b64 = f.read().strip()
with open('frontend/src/utils/fonts.ts', 'w') as f2:
    f2.write(f"export const ROBOTO_FLEX_REGULAR = '{b64}';\n")
print('frontend/src/utils/fonts.ts created successfully')
