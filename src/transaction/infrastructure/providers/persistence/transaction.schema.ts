import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'transactions', timestamps: true })
export class TransactionDocument extends Document {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  receiverDocument: string;

  @Prop({ required: true })
  receiverDocumentType: string;

  @Prop({ required: true })
  receiverName: string;

  @Prop({ required: true })
  receiverAccount: string;

  @Prop({ required: true })
  receiverAccountType: string;

  @Prop({ required: true })
  status: string;
}

export const TransactionSchema =
  SchemaFactory.createForClass(TransactionDocument);
