import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

// Base UI shares popup, portal and title with Dialog; Root owns alert behavior.
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogDescription = AlertDialogPrimitive.Description;

export { AlertDialog, AlertDialogDescription };
