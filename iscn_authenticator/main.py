import re

def _validate_total_chromosome_number(number_part: str) -> bool:
    """Validates the total chromosome number part of the karyotype."""
    return number_part.isdigit()

def _validate_sex_chromosomes(sex_chromosome_part: str) -> bool:
    """Validates the sex chromosomes part of the karyotype."""
    return bool(re.match(r"^(X|Y)+$", sex_chromosome_part))

def _validate_coherence(total_chromosome_number: int, sex_chromosomes: str) -> bool:
    """Validates coherence between total chromosome number and sex chromosomes."""
    if total_chromosome_number == 46:
        if len(sex_chromosomes) != 2:
            return False
    elif total_chromosome_number == 45:
        if len(sex_chromosomes) != 1:
            return False
    return True

def _validate_deletion_content(content: str) -> bool:
    """Validates the content string of a deletion, e.g., 'q13' or 'q13q33'."""
    # Terminal deletion: [pq]\d+(\.\d+)?
    if re.fullmatch(r"[pq]\d+(\.\d+)?", content):
        return True

    # Interstitial deletion: [pq]\d+(\.\d+)?\d+(\.\d+)?
    if re.fullmatch(r"[pq]\d+(\.\d+)?\d+(\.\d+)?", content):
        return True
    
    return False

def _validate_abnormalities(abnormality_parts: list[str]) -> bool:
    """Validates the abnormality parts of the karyotype."""
    for part in abnormality_parts:
        if re.fullmatch(r"^[+-]\d+$", part):
            continue # It is a valid numeric abnormality
        
        del_match = re.fullmatch(r"^del\((\d{1,2}|[XY])\)\((.+)\)$", part)
        if del_match:
            content = del_match.group(2)
            if _validate_deletion_content(content):
                continue
        
        return False # If no match, then it's an invalid part
    return True

def is_valid_karyotype(karyotype: str) -> bool:
    """
    Validates a simple ISCN karyotype string.
    """
    parts = karyotype.split(',')
    if len(parts) < 2:
        return False

    # Validate total chromosome number
    if not _validate_total_chromosome_number(parts[0]):
        return False
    total_chromosome_number = int(parts[0])

    # Validate sex chromosomes
    sex_chromosomes = parts[1]
    if not _validate_sex_chromosomes(sex_chromosomes):
        return False

    # Validate coherence between total chromosome number and sex chromosomes
    if not _validate_coherence(total_chromosome_number, sex_chromosomes):
        return False

    # Handle abnormalities
    if len(parts) > 2:
        if not _validate_abnormalities(parts[2:]):
            return False

    # Basic validation for now, more rules to be added.
    return True

if __name__ == "__main__":
    karyotype_string = input("Enter karyotype string: ")
    if is_valid_karyotype(karyotype_string):
        print("Valid")
    else:
        print("Invalid")
